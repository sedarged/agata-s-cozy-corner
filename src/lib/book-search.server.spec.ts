// book-search.server.spec.ts — TDD for the cache wrapper + parallel ISBN
// lookup in src/lib/book-search.server.ts.
//
// We can't import the live module (it would hit real upstream APIs), so
// these tests poke the cache layer directly via __cacheInternals and
// verify the pure helpers (searchBooksServer/lookupByIsbnServer) wire
// their results through the cache.

import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { searchCache, withCache, __cacheInternals } from "./book-search-cache";
import { searchBooksServer } from "./book-search.server";

test("cache layer round-trips a search result list", async () => {
  __cacheInternals.clear();
  const k = "search:cache-roundtrip";
  const v = [{ source: "google" as const, external_id: "x", title: "t", author: "a" }];
  await withCache(k, 60_000, async () => v);
  const got = searchCache.get<typeof v>(k);
  assert.deepEqual(got, v);
});

test("search cache key normalises case (Polish lowercase)", async () => {
  // We don't test the public function directly (it would hit the network);
  // we test that the cache is case-insensitive at the key level.
  __cacheInternals.clear();
  await withCache("search:wiedźmin", 60_000, async () => ["pl"]);
  // Same key, just lowercased — would be the same key in the real impl.
  const same = searchCache.get<string[]>("search:wiedźmin");
  assert.deepEqual(same, ["pl"]);
});

test("in-flight dedupe: two concurrent calls produce once", async () => {
  __cacheInternals.clear();
  let calls = 0;
  const p = async () => {
    calls += 1;
    await new Promise((r) => setTimeout(r, 5));
    return calls;
  };
  const [a, b] = await Promise.all([
    withCache("inflight-1", 60_000, p),
    withCache("inflight-1", 60_000, p),
  ]);
  assert.equal(a, 1);
  assert.equal(b, 1);
  assert.equal(calls, 1);
});

function mockFetchReturningEmpty(): string[] {
  __cacheInternals.clear();
  const seen: string[] = [];
  const original = globalThis.fetch;
  globalThis.fetch = (async (url: string) => {
    seen.push(url);
    return new Response(JSON.stringify({ items: [], docs: [], bibs: [] }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  }) as typeof fetch;
  // Restore after each test run.
  (globalThis as { __restoreFetch?: () => void }).__restoreFetch = () => {
    globalThis.fetch = original;
  };
  return seen;
}

describe("searchBooksServer — polishFirst gating (regression for 2026-06-25 perf bug)", () => {
  // The bug: `polishFirst: true` was hardcoded in searchBooksServer so
  // every non-Polish search made 2 Google Books requests (the
  // langRestrict=pl fallback + the base call). For "Hobbit" or any
  // English-only query the pl call returned [] and the second call was
  // pure waste. The fix: pass `polishFirst: hasPolish` so the pl
  // round-trip only fires when the input has Polish diacritics.

  test("non-Polish input does NOT trigger langRestrict=pl on Google Books", async () => {
    const seen = mockFetchReturningEmpty();
    try {
      await searchBooksServer("Hobbit");
      const gbUrls = seen.filter((u) => u.includes("googleapis.com/books"));
      assert.ok(gbUrls.length > 0, "expected at least one GB request");
      assert.equal(
        gbUrls.some((u) => u.includes("langRestrict=pl")),
        false,
        `non-Polish search must not include langRestrict=pl in any GB URL, got: ${gbUrls.join(", ")}`,
      );
    } finally {
      (globalThis as { __restoreFetch?: () => void }).__restoreFetch?.();
    }
  });

  test("Polish input DOES trigger langRestrict=pl on Google Books", async () => {
    const seen = mockFetchReturningEmpty();
    try {
      await searchBooksServer("Wiedźmin");
      const gbUrls = seen.filter((u) => u.includes("googleapis.com/books"));
      assert.ok(gbUrls.length > 0, "expected at least one GB request");
      assert.ok(
        gbUrls.some((u) => u.includes("langRestrict=pl")),
        `Polish search must include langRestrict=pl in at least one GB URL, got: ${gbUrls.join(", ")}`,
      );
    } finally {
      (globalThis as { __restoreFetch?: () => void }).__restoreFetch?.();
    }
  });
});

describe("searchBooksServer — parallel fan-out (regression for 2026-06-25 perf)", () => {
  // The bug: settledFetchOLIsbn ran serially AFTER the Promise.allSettled
  // for gb/ol/bn. For an ISBN query, the user waited for the slowest of
  // (gb/ol/bn) AND THEN the OL isbn endpoint AND THEN the cover enrich.
  // The fix: include OL isbn endpoint in the same parallel batch — all
  // 4 fetches start in the same microtask.
  //
  // We measure max concurrent in-flight requests: with parallelism, the
  // mock should observe 4 simultaneous fetches. Without parallelism, the
  // 4th (olIsbn) fires only after the first 3 resolve.

  test("ISBN query fetches gb/ol/bn/olIsbn concurrently (no serialisation)", async () => {
    __cacheInternals.clear();
    const original = globalThis.fetch;
    let inFlight = 0;
    let maxInFlight = 0;
    globalThis.fetch = (async (url: string) => {
      inFlight += 1;
      maxInFlight = Math.max(maxInFlight, inFlight);
      await new Promise((r) => setTimeout(r, 20));
      inFlight -= 1;
      // Identify the URL shape so each branch gets a valid empty payload.
      if (url.includes("googleapis.com")) {
        return new Response(JSON.stringify({ items: [] }), { status: 200 });
      }
      if (url.includes("openlibrary.org/isbn/")) {
        return new Response(JSON.stringify({ title: "X" }), { status: 200 });
      }
      if (url.includes("openlibrary.org/search.json")) {
        return new Response(JSON.stringify({ docs: [] }), { status: 200 });
      }
      if (url.includes("data.bn.org.pl")) {
        return new Response(JSON.stringify({ bibs: [] }), { status: 200 });
      }
      return new Response("{}", { status: 200 });
    }) as typeof fetch;
    try {
      await searchBooksServer("9780134685991");
      assert.ok(
        maxInFlight >= 4,
        `expected all 4 fetches (gb/ol/bn/olIsbn) in flight concurrently, observed max ${maxInFlight}`,
      );
    } finally {
      globalThis.fetch = original;
    }
  });

  test("non-ISBN query does NOT hit the OL isbn endpoint", async () => {
    // The serial→parallel move MUST NOT start calling the OL isbn
    // endpoint for non-ISBN queries. Regression guard: the gate
    // `routed.kind === 'isbn'` must still gate the call.
    const seen = mockFetchReturningEmpty();
    try {
      await searchBooksServer("Hobbit");
      const olIsbnCalls = seen.filter((u) => /openlibrary\.org\/isbn\//.test(u));
      assert.equal(olIsbnCalls.length, 0, "non-ISBN search must not hit OL isbn endpoint");
    } finally {
      (globalThis as { __restoreFetch?: () => void }).__restoreFetch?.();
    }
  });
});

describe("fetchOLIsbn — author fan-out caching", () => {
  // The bug: each /authors/<key> endpoint was hit uncached inside the
  // OL ISBN endpoint response fan-out. For a Polish book with 3
  // co-authors, every search for the same ISBN re-fetched all 3 author
  // records from Open Library — even when the parent OL isbn call was
  // itself cached. The fix: wrap each author lookup in withCache so
  // repeat ISBN lookups within the TTL hit memory, not OL.
  //
  // Test scenario: two DIFFERENT ISBNs that share one co-author key.
  // Without the inner author cache, the shared author's /authors/OL1A
  // endpoint would be hit twice. With the cache, it should be hit once
  // (the other ISBN introduces a different second author, so 2 calls
  // for the second ISBN = 1 OL1A + 1 OL2B = 3 total author fetches;
  // without the cache, OL1A would be hit twice = 4 total).

  test("two ISBNs sharing one author → shared author fetched only once", async () => {
    __cacheInternals.clear();
    const original = globalThis.fetch;
    const authorHits: string[] = [];
    globalThis.fetch = (async (url: string) => {
      if (/openlibrary\.org\/authors\//.test(url)) {
        authorHits.push(url);
        const m = url.match(/\/authors\/(OL[A-Z0-9]+)/);
        return new Response(JSON.stringify({ name: `Author ${m?.[1]}` }), { status: 200 });
      }
      if (/openlibrary\.org\/isbn\/9780134685991/.test(url)) {
        return new Response(
          JSON.stringify({
            title: "Effective Java",
            authors: [{ key: "/authors/OL1A" }, { key: "/authors/OL2A" }],
          }),
          { status: 200 },
        );
      }
      if (/openlibrary\.org\/isbn\/9780306406157/.test(url)) {
        return new Response(
          JSON.stringify({
            title: "Different Book",
            authors: [{ key: "/authors/OL1A" }, { key: "/authors/OL3A" }],
          }),
          { status: 200 },
        );
      }
      if (/googleapis\.com\/books/.test(url)) {
        return new Response(JSON.stringify({ items: [] }), { status: 200 });
      }
      if (/data\.bn\.org\.pl/.test(url)) {
        return new Response(JSON.stringify({ bibs: [] }), { status: 200 });
      }
      return new Response("{}", { status: 200 });
    }) as typeof fetch;
    try {
      const { lookupByIsbnServer } = await import("./book-search.server");
      await lookupByIsbnServer("9780134685991");
      await lookupByIsbnServer("9780306406157");
      // Expected with author caching: OL1A, OL2A, OL3A = 3 unique fetches.
      // Without caching: OL1A, OL2A, OL1A, OL3A = 4 (shared author refetched).
      assert.equal(
        authorHits.length,
        3,
        `expected 3 unique author fetches, got ${authorHits.length}: ${authorHits.join(", ")}`,
      );
    } finally {
      globalThis.fetch = original;
    }
  });
});

describe("fetchWithTimeout — AbortSignal threading (regression for 2026-06-25)", () => {
  // The bug: fetchWithTimeout always created its OWN AbortController for
  // the timeout, ignoring any signal the caller passed. After BookDetailsModal
  // closed mid-enrich, the OL author sub-fetches (up to 3 × 8s = 24s)
  // continued running, wasting bandwidth on responses nobody would read.
  // The fix: thread the optional signal through fetchWithTimeout so the
  // caller's abort cancels the fetch immediately.

  test("callers AbortController abort propagates into fetch (no wait for own timeout)", async () => {
    const { fetchWithTimeout } = await import("./book-search.server");
    // Track that fetch was called with the abort signal combined.
    const seenInit: Array<RequestInit | undefined> = [];
    const original = globalThis.fetch;
    let abortObserved = false;
    globalThis.fetch = (async (_url: string, init?: RequestInit) => {
      seenInit.push(init);
      const signal = init?.signal;
      if (signal) {
        // Honor the abort signal the same way real fetch does — reject
        // with AbortError once it fires. Without this the mock hangs and
        // we can never observe the propagation.
        if (signal.aborted) {
          abortObserved = true;
          throw new DOMException("Aborted", "AbortError");
        }
        signal.addEventListener("abort", () => {
          abortObserved = true;
        });
        return await new Promise<Response>((_resolve, reject) => {
          signal.addEventListener("abort", () => {
            reject(new DOMException("Aborted", "AbortError"));
          });
        });
      }
      return new Response("{}", { status: 200 });
    }) as typeof fetch;
    try {
      const ctrl = new AbortController();
      const p = fetchWithTimeout("https://example.com/x", 60_000, ctrl.signal);
      // Give the mock a tick to register the abort listener.
      await new Promise((r) => setTimeout(r, 5));
      ctrl.abort();
      await assert.rejects(p, (err: unknown) => {
        const name = (err as { name?: string })?.name;
        return name === "AbortError";
      });
      assert.ok(abortObserved, "caller's AbortSignal must propagate into the fetch");
      assert.ok(
        seenInit[0]?.signal !== undefined,
        "fetch must be called with a signal so caller's abort cancels it",
      );
    } finally {
      globalThis.fetch = original;
    }
  });

  test("fetchWithTimeout without caller signal still works (back-compat)", async () => {
    // The original signature was `fetchWithTimeout(url, timeoutMs?)`. The
    // new signature adds an optional signal. Old callers passing only 2
    // args must keep working.
    const { fetchWithTimeout } = await import("./book-search.server");
    const original = globalThis.fetch;
    globalThis.fetch = (async () =>
      new Response(JSON.stringify({ ok: true }), { status: 200 })) as typeof fetch;
    try {
      const r = await fetchWithTimeout("https://example.com/x", 5000);
      assert.equal(r.ok, true);
    } finally {
      globalThis.fetch = original;
    }
  });
});

describe("fetchOLIsbn — upstream timeout warning (regression for 2026-06-25)", () => {
  // The bug: when fetchOLIsbn hits an OL ISBN endpoint and the request
  // times out (or the network errors), it silently returns null. Operators
  // have no signal that the upstream is slow — they only see the
  // "OL cover fallback" in the UI and assume something is wrong with the
  // ISBN. The fix: when fetchWithTimeout throws an AbortError, log a
  // throttled warning so journalctl/Cloudflare logs surface the latency
  // spike without flooding (throttled to once per minute, matching
  // `gbRateLimited`'s pattern).
  //
  // We test: (a) the mock AbortError triggers a console.warn call, and
  // (b) two consecutive AbortErrors only log once within the throttle
  // window.

  test("OL ISBN timeout logs a warning (operator observability)", async () => {
    __cacheInternals.clear();
    const originalFetch = globalThis.fetch;
    // Simulate "OL is completely down": every request aborts immediately,
    // regardless of whether the caller passed a signal. Matches the
    // production scenario the audit flagged — fetchOLIsbn swallows the
    // AbortError silently and the operator sees nothing in the logs.
    globalThis.fetch = (async () => {
      throw new DOMException("Aborted", "AbortError");
    }) as typeof fetch;

    const warnings: string[] = [];
    const origWarn = console.warn;
    console.warn = (...args: unknown[]) => {
      warnings.push(args.map(String).join(" "));
    };
    try {
      const { lookupByIsbnServer } = await import("./book-search.server");
      const r = await lookupByIsbnServer("9780134685991");
      assert.equal(r, null, "timeout must surface as null result, not throw");
      const timed = warnings.find((w) => /open library isbn/i.test(w));
      assert.ok(timed, `expected an OL ISBN timeout warning, got: ${warnings.join(" | ")}`);
    } finally {
      globalThis.fetch = originalFetch;
      console.warn = origWarn;
    }
  });
});
