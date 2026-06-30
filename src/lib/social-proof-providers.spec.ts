// Agata — §4.5 NYT critic reviews + §4.3 LibraryThing tags tests.
//
// Both providers share the same `MockableFetchInput` pattern: when the
// upstream token is unset we return `null`, and the route layer falls back
// to the Hardcover row (or the mock). We pin that contract here.
import { test } from "node:test";
import assert from "node:assert/strict";
import { fetchNytReviews, fetchLibraryThingReviews } from "./social-proof.server";

test("fetchNytReviews: returns null when NYT_API_KEY is unset", async () => {
  const prev = process.env.NYT_API_KEY;
  delete process.env.NYT_API_KEY;
  try {
    const r = await fetchNytReviews({
      bookId: "bk-1",
      isbn: "9780140449266",
      title: "T",
      author: "A",
    });
    assert.equal(r, null);
  } finally {
    if (prev !== undefined) process.env.NYT_API_KEY = prev;
  }
});

test("fetchNytReviews: marks source as 'nyt' and reviewType as 'critic' on hit", async () => {
  const prev = process.env.NYT_API_KEY;
  process.env.NYT_API_KEY = "fake-key";
  const originalFetch = globalThis.fetch;
  // Stub NYT's books API: return one critic review keyed by ISBN.
  globalThis.fetch = (async (url: string | URL | Request) => {
    const u = typeof url === "string" ? url : url instanceof URL ? url.toString() : url.url;
    if (!u.includes("api.nytimes.com")) throw new Error("unexpected fetch: " + u);
    return new Response(
      JSON.stringify({
        status: "OK",
        num_results: 1,
        results: [
          {
            url: "https://www.nytimes.com/2025/01/01/books/review.html",
            publication_dt: "2025-01-01",
            byline: "A Critic",
            book_title: "T",
            book_author: "A",
            summary: "A penetrating review.",
          },
        ],
      }),
      { status: 200, headers: { "content-type": "application/json" } },
    );
  }) as typeof fetch;
  try {
    const r = await fetchNytReviews({
      bookId: "bk-1",
      isbn: "9780140449266",
      title: "T",
      author: "A",
    });
    assert.ok(r);
    assert.equal(r!.sources.nyt, true);
    assert.ok(r!.reviewHighlights.length >= 1);
    for (const h of r!.reviewHighlights) {
      assert.equal(h.source, "nyt");
      assert.equal(h.reviewType, "critic");
    }
  } finally {
    if (prev === undefined) delete process.env.NYT_API_KEY;
    else process.env.NYT_API_KEY = prev;
    globalThis.fetch = originalFetch;
  }
});

test("fetchNytReviews: returns null on upstream 4xx/5xx", async () => {
  const prev = process.env.NYT_API_KEY;
  process.env.NYT_API_KEY = "fake-key";
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async () => new Response("nope", { status: 500 })) as typeof fetch;
  try {
    const r = await fetchNytReviews({ bookId: "bk-1", title: "T" });
    assert.equal(r, null);
  } finally {
    if (prev === undefined) delete process.env.NYT_API_KEY;
    else process.env.NYT_API_KEY = prev;
    globalThis.fetch = originalFetch;
  }
});

test("fetchLibraryThingReviews: returns null when LIBRARYTHING_TOKEN is unset", async () => {
  const prev = process.env.LIBRARYTHING_TOKEN;
  delete process.env.LIBRARYTHING_TOKEN;
  try {
    const r = await fetchLibraryThingReviews({ bookId: "bk-1", isbn: "9780140449266" });
    assert.equal(r, null);
  } finally {
    if (prev !== undefined) process.env.LIBRARYTHING_TOKEN = prev;
  }
});

test("fetchLibraryThingReviews: marks source as 'librarything' and reviewType as 'tag' on hit", async () => {
  const prev = process.env.LIBRARYTHING_TOKEN;
  process.env.LIBRARYTHING_TOKEN = "fake-token";
  const originalFetch = globalThis.fetch;
  // Use a template literal (NOT JSON.stringify) — the parser looks for
  // literal `<review>…</review>` substrings, and a JSON-stringified XML
  // body would double-quote it (passing by accident because the regex
  // doesn't anchor on quote characters).
  const xmlBody = `<ltmlc><reviews><review><rating>4</rating><reviewer>Alice</reviewer><comment>Sharp.</comment><date>2025-02-02</date></review></reviews></ltmlc>`;
  globalThis.fetch = (async (url: string | URL | Request) => {
    const u = typeof url === "string" ? url : url instanceof URL ? url.toString() : url.url;
    if (!u.includes("librarything.com")) throw new Error("unexpected fetch: " + u);
    return new Response(xmlBody, { status: 200, headers: { "content-type": "application/xml" } });
  }) as typeof fetch;
  try {
    const r = await fetchLibraryThingReviews({ bookId: "bk-1", isbn: "9780140449266" });
    assert.ok(r);
    assert.equal(r!.sources.libraryThing, true);
    assert.ok(r!.reviewHighlights.length >= 1);
    for (const h of r!.reviewHighlights) {
      assert.equal(h.source, "librarything");
      assert.equal(h.reviewType, "tag");
    }
  } finally {
    if (prev === undefined) delete process.env.LIBRARYTHING_TOKEN;
    else process.env.LIBRARYTHING_TOKEN = prev;
    globalThis.fetch = originalFetch;
  }
});

test("fetchLibraryThingReviews: returns null on upstream 4xx/5xx", async () => {
  const prev = process.env.LIBRARYTHING_TOKEN;
  process.env.LIBRARYTHING_TOKEN = "fake-token";
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async () => new Response("nope", { status: 500 })) as typeof fetch;
  try {
    const r = await fetchLibraryThingReviews({ bookId: "bk-1", isbn: "9780140449266" });
    assert.equal(r, null);
  } finally {
    if (prev === undefined) delete process.env.LIBRARYTHING_TOKEN;
    else process.env.LIBRARYTHING_TOKEN = prev;
    globalThis.fetch = originalFetch;
  }
});
