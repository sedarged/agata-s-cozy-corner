// book-search-cache.ts — small in-memory cache for the upstream book APIs.
//
// Why: scanning the search results can re-issue identical queries (e.g. when
// the user types a prefix and then backspaces). A short-TTL in-memory cache
// dedupes these calls so we don't hit Google Books + Open Library +
// Biblioteka Narodowa three times for the same string.
//
// Properties:
//   - TTL-based expiry; default 60s.
//   - Per-key in-flight de-duplication: two concurrent calls for the same
//     key share the producer (no thundering herd).
//   - Errors are NOT cached: a transient upstream blip must not freeze
//     results for the whole TTL window.
//   - Bounded size (MAX_ENTRIES) to prevent unbounded memory under
//     sustained distinct queries (LRU-ish: oldest-at inserted first,
//     evicted on insert when full).

const MAX_ENTRIES = 256;

interface Entry {
  at: number;
  value: unknown;
  // An in-flight promise (when status === "pending") is shared by
  // concurrent callers so the producer runs once per key.
  status: "ready" | "pending";
  inflight?: Promise<unknown>;
  // TTL on ready entries (set when we stored the value). Optional
  // because pending entries don't have a TTL yet.
  ttl?: number;
}

const store = new Map<string, Entry>();

function evictExpired(now: number) {
  for (const [k, e] of store) {
    if (e.status === "ready" && e.ttl != null && now - e.at >= e.ttl) store.delete(k);
  }
}

function maybeEvict(now: number) {
  // Cheap, only runs on insert. We bound by `store.size` against MAX_ENTRIES.
  if (store.size < MAX_ENTRIES) return;
  // Remove expired first.
  for (const [k, e] of store) {
    if (e.status === "ready" && e.ttl != null && now - e.at >= e.ttl) {
      store.delete(k);
    }
  }
  // Still over cap? Drop the oldest ready entries (Map preserves insertion
  // order; "oldest" = first iterated).
  if (store.size < MAX_ENTRIES) return;
  for (const k of store.keys()) {
    if (store.size <= MAX_ENTRIES - 1) break;
    const e = store.get(k);
    if (e && e.status === "ready") {
      store.delete(k);
    }
  }
}

export interface CacheApi {
  /** Store a value under `key` with the given TTL (ms). */
  set<T>(key: string, ttlMs: number, value: T): void;
  /** Return a value if present and not expired, else `undefined`. */
  get<T>(key: string): T | undefined;
  /** Drop a specific key. Useful for tests and forced-refresh. */
  delete(key: string): void;
  /** Drop everything. */
  clear(): void;
}

export const searchCache: CacheApi = {
  set(key, ttl, value) {
    const now = Date.now();
    maybeEvict(now);
    store.set(key, { at: now, value, status: "ready", ttl });
  },
  get(key) {
    const e = store.get(key);
    if (!e || e.status !== "ready" || e.ttl == null) return undefined;
    if (Date.now() - e.at >= e.ttl) {
      store.delete(key);
      return undefined;
    }
    return e.value as never;
  },
  delete(key) {
    store.delete(key);
  },
  clear() {
    store.clear();
  },
};

/**
 * Run `producer` under a per-key lock. Concurrent callers for the same
 * key share the producer; subsequent callers within TTL get the cached
 * value. Producer errors are NOT cached.
 */
export async function withCache<T>(
  key: string,
  ttlMs: number,
  producer: () => Promise<T>,
): Promise<T> {
  const existing = store.get(key);
  const now = Date.now();
  // Serve a ready value if it's still fresh.
  if (
    existing &&
    existing.status === "ready" &&
    existing.ttl != null &&
    now - existing.at < existing.ttl
  ) {
    return existing.value as T;
  }
  // If another caller is already running the producer, await it.
  if (existing && existing.status === "pending" && existing.inflight) {
    return (await existing.inflight) as T;
  }
  // Otherwise become the producer.
  const p = (async () => {
    try {
      const v = await producer();
      // Store the resolved value, replacing any pending entry.
      const t = Date.now();
      maybeEvict(t);
      store.set(key, { at: t, value: v, status: "ready", ttl: ttlMs });
      return v;
    } catch (err) {
      // Remove the pending entry so the next call retries.
      const pending = store.get(key);
      if (pending && pending.status === "pending") store.delete(key);
      throw err;
    }
  })();
  // Register the in-flight promise.
  store.set(key, { at: now, value: undefined, status: "pending", inflight: p });
  return p;
}

/** Test-only internals. Not part of the stable surface. */
export const __cacheInternals = {
  size: () => store.size,
  clear: () => searchCache.clear(),
  delete: (k: string) => searchCache.delete(k),
};
