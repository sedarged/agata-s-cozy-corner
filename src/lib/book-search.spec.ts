// book-search.spec.ts — regression test for the paginated-response
// unwrap added to src/lib/book-search.ts.
//
// The /api/book-search endpoint returns a Page<T> object
// ({ items, page, pageSize, total, hasMore }), but the client
// searchBooks() wrapper is documented to return BookSearchResult[].
// Without the unwrap, the add-book search tab silently renders no
// results because `results.length` is undefined on a plain object.
import assert from "node:assert/strict";
import { test } from "node:test";

// We can't import searchBooks directly because it talks to /api/book-search,
// so we re-test the unwrap logic by mocking fetch.

test("searchBooks unwraps Page<T>.items into a flat array", async () => {
  const original = globalThis.fetch;
  const fakeItems = [{ source: "openlibrary", external_id: "x", title: "Foo", author: "Bar" }];
  globalThis.fetch = (async () =>
    new Response(
      JSON.stringify({ page: 1, pageSize: 20, total: 1, items: fakeItems, hasMore: false }),
      { status: 200, headers: { "content-type": "application/json" } },
    )) as unknown as typeof fetch;
  try {
    const { searchBooks } = await import("./book-search");
    const out = await searchBooks("foo");
    assert.ok(Array.isArray(out), "expected an array");
    assert.equal(out.length, 1);
    assert.equal(out[0].title, "Foo");
  } finally {
    globalThis.fetch = original;
  }
});

test("searchBooks returns [] when response is missing items", async () => {
  const original = globalThis.fetch;
  globalThis.fetch = (async () =>
    new Response(JSON.stringify({ unexpected: true }), {
      status: 200,
      headers: { "content-type": "application/json" },
    })) as unknown as typeof fetch;
  try {
    const { searchBooks } = await import("./book-search");
    const out = await searchBooks("anything-new-" + Date.now());
    assert.deepEqual(out, []);
  } finally {
    globalThis.fetch = original;
  }
});
