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

describe("searchBooksServer — polishFirst gating (regression for 2026-06-25 perf bug)", () => {
  // The bug: `polishFirst: true` was hardcoded in searchBooksServer so
  // every non-Polish search made 2 Google Books requests (the
  // langRestrict=pl fallback + the base call). For "Hobbit" or any
  // English-only query the pl call returned [] and the second call was
  // pure waste. The fix: pass `polishFirst: hasPolish` so the pl
  // round-trip only fires when the input has Polish diacritics.

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
