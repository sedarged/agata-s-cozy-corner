// book-search-google-key.spec.ts — verifies that GOOGLE_BOOKS_API_KEY
// gets injected into every Google Books request so the GB second-source
// cover upgrade stops silently returning [] when the shared default
// project is 429-limited.
//
// Root cause (2026-06-24): the live GB API returns 429 from this IP
// because all unkeyed requests go through `project_number:624717413613` —
// a shared default pool routinely exhausted by other consumers. Result:
// most search results have no cover and BookCover's `onError` triggers
// the gradient placeholder. Adding an API key (free tier: 1000 req/day)
// routes quota to the operator's own GCP project.
//
// We don't reach the live network. The tests mock `globalThis.fetch`
// and inspect the URL.

import { afterEach, beforeEach, describe, it } from "node:test";
import assert from "node:assert/strict";

import { searchBooksServer } from "./book-search.server";
import { __cacheInternals } from "./book-search-cache";

const realFetch = globalThis.fetch;
const seen: string[] = [];

const ORIGINAL_KEY = process.env.GOOGLE_BOOKS_API_KEY;

beforeEach(() => {
  __cacheInternals.clear();
  seen.length = 0;
});

afterEach(() => {
  globalThis.fetch = realFetch;
  __cacheInternals.clear();
  if (ORIGINAL_KEY === undefined) delete process.env.GOOGLE_BOOKS_API_KEY;
  else process.env.GOOGLE_BOOKS_API_KEY = ORIGINAL_KEY;
});

function mockAllGbEmpty(): void {
  globalThis.fetch = (async (url: string | URL) => {
    const u = String(url);
    seen.push(u);
    if (u.startsWith("https://www.googleapis.com/books/v1/volumes")) {
      return new Response(JSON.stringify({ totalItems: 0, items: [] }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    }
    if (u.startsWith("https://openlibrary.org/")) {
      return new Response(JSON.stringify({ numFound: 0, docs: [] }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    }
    if (u.startsWith("https://data.bn.org.pl/api/institutions/bibs.json")) {
      return new Response(JSON.stringify({ bibs: [] }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    }
    throw new Error(`mock-fetch: no handler for ${u}`);
  }) as typeof fetch;
}

describe("searchGoogleBooks — GOOGLE_BOOKS_API_KEY injection", () => {
  it("omits the key parameter when GOOGLE_BOOKS_API_KEY is unset", async () => {
    delete process.env.GOOGLE_BOOKS_API_KEY;
    mockAllGbEmpty();
    await searchBooksServer("Wiedźmin");
    const gbCalls = seen.filter((u) => u.startsWith("https://www.googleapis.com/books/v1/volumes"));
    assert.ok(gbCalls.length > 0, "expected at least one GB call");
    for (const u of gbCalls) {
      assert.equal(u.includes("&key="), false, `unexpected &key= in ${u}`);
    }
  });

  it("appends &key=<KEY> to every GB request when GOOGLE_BOOKS_API_KEY is set", async () => {
    // Regression for the 2026-06-24 rate-limit bug: without a key, GB
    // returns 429 from this IP and the cover upgrade silently fails.
    // With a key, the request goes against the operator's own quota.
    process.env.GOOGLE_BOOKS_API_KEY = "test-key-abc-123";
    mockAllGbEmpty();
    await searchBooksServer("Wiedźmin");
    const gbCalls = seen.filter((u) => u.startsWith("https://www.googleapis.com/books/v1/volumes"));
    assert.ok(gbCalls.length > 0, "expected at least one GB call");
    for (const u of gbCalls) {
      assert.match(u, /[?&]key=test-key-abc-123\b/, `missing key in ${u}`);
    }
  });

  it("URL-encodes keys with reserved characters", async () => {
    // A key with `&` or `=` would corrupt the query string if not
    // encoded. encodeURIComponent must be applied.
    process.env.GOOGLE_BOOKS_API_KEY = "key&with=special";
    mockAllGbEmpty();
    await searchBooksServer("Hobbit");
    const gbCalls = seen.filter((u) => u.startsWith("https://www.googleapis.com/books/v1/volumes"));
    assert.ok(gbCalls.length > 0, "expected at least one GB call");
    for (const u of gbCalls) {
      assert.ok(u.includes("key=key%26with%3Dspecial"), `expected encoded key in ${u}, got ${u}`);
      // And the un-encoded form MUST NOT appear (would corrupt the URL).
      assert.equal(u.includes("key=key&"), false, `un-encoded & leaked into ${u}`);
    }
  });
});
