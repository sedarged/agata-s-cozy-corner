// Agata — review cache TTL helpers (§9 polish plan).
//
// Pure functions used by the social-proof fetcher (`src/lib/social-proof.server.ts`)
// to decide whether to replay a cached row or call upstream. Kept separate
// from the Drizzle repo so the TTL math stays trivially unit-testable
// without spinning up SQLite.

/**
 * Returns true when the cached `fetchedAt` is older than `ttlDays` days
 * from now, or when `fetchedAt` is empty / unparseable. The route layer
 * treats any `true` as "fetch fresh, then upsert".
 */
export function isCacheStale(fetchedAt: string, ttlDays: number): boolean {
  if (!fetchedAt) return true;
  const fetchedMs = Date.parse(fetchedAt);
  if (Number.isNaN(fetchedMs)) return true;
  const ageDays = (Date.now() - fetchedMs) / (24 * 60 * 60 * 1000);
  return ageDays >= ttlDays;
}

/**
 * Read the cache TTL from env, defaulting to 7 days. Accepts an env-like
 * object so tests can inject values without mutating `process.env`.
 *
 * Non-numeric or zero/negative values fall back to the 7-day default —
 * the operator shouldn't be able to disable the cache by setting
 * `BOOK_PROVIDER_CACHE_TTL_DAYS=0`.
 */
export function reviewCacheTtlDaysFromEnv(env: Record<string, string | undefined>): number {
  const raw = env.BOOK_PROVIDER_CACHE_TTL_DAYS;
  const parsed = raw ? Number(raw) : NaN;
  if (!Number.isFinite(parsed) || parsed <= 0) return 7;
  return parsed;
}
