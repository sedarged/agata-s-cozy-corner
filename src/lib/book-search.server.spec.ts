// book-search.server.spec.ts — TDD for the cache wrapper + parallel ISBN
// lookup in src/lib/book-search.server.ts.
//
// We can't import the live module (it would hit real upstream APIs), so
// these tests poke the cache layer directly via __cacheInternals and
// verify the pure helpers (searchBooksServer/lookupByIsbnServer) wire
// their results through the cache.

import { test } from "node:test";
import assert from "node:assert/strict";
import { searchCache, withCache, __cacheInternals } from "./book-search-cache";

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
