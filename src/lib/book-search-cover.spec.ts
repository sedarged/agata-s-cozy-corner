// book-search-cover.spec.ts — TDD for the cover-source upgrade chain.
//
// `searchBooksServer`, `lookupByIsbnServer`, and `enrichBookDetailsServer`
// all run `enrichCover` (async) on the merged result. `enrichCover`
// resolves the cover in this order:
//
//   1. If the result already has a Google Books cover, keep it (no point
//      re-querying the same source for the same image).
//   2. Otherwise, ask Google Books `?isbn:<ISBN>`. GB carries covers for
//      many Polish / niche titles that OL lacks — even when the OL
//      `search.json` returned a `cover_i` and gave us a smaller image.
//      When GB returns a `zoom=2` thumbnail, it overrides the OL image.
//   3. If GB is unreachable or has no cover, keep any existing OL cover
//      (don't downgrade).
//   4. If the result has NO cover at all, point at Open Library's
//      `covers/b/isbn/<ISBN>-L.jpg` endpoint. That URL 404s gracefully
//      when no OL cover exists, and `BookCover`'s `onError` falls back
//      to the gradient placeholder.
//
// Why: before this chain, search results could come back without a cover
// or with a low-quality OL `-L.jpg` even when GB had a sharper image
// for the same ISBN. The GB upgrade pass turns those into the sharper
// GB image at zero UX cost (the OL image 404s gracefully anyway).
//
// These tests mock `globalThis.fetch` to drive each upstream source
// independently so we can verify the merge + upgrade behaviour without
// hitting the live network.

import { afterEach, beforeEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import { searchBooksServer, lookupByIsbnServer } from "./book-search.server";
import { __cacheInternals } from "./book-search-cache";

interface FetchCall {
  url: string;
  init: RequestInit;
}

const calls: FetchCall[] = [];
const realFetch = globalThis.fetch;

beforeEach(() => {
  __cacheInternals.clear();
  calls.length = 0;
});

afterEach(() => {
  globalThis.fetch = realFetch;
  __cacheInternals.clear();
});

function mockFetchByUrl(handlers: Record<string, () => Response>): void {
  globalThis.fetch = (async (url: string | URL, init?: RequestInit) => {
    const u = String(url);
    calls.push({ url: u, init: init ?? {} });
    // Find the longest matching prefix (most specific match wins).
    const keys = Object.keys(handlers).sort((a, b) => b.length - a.length);
    for (const prefix of keys) {
      if (u.startsWith(prefix)) return handlers[prefix]!();
    }
    throw new Error(`mock-fetch: no handler for ${u}`);
  }) as typeof fetch;
}

/**
 * `searchGoogleBooks(q)` URL-encodes the colon, so the wire URL is
 * `q=isbn%3A<ISBN>` — NOT `q=isbn:<ISBN>`. The mock's prefix matching
 * must use the encoded form, otherwise the ISBN-specific handler is
 * never reached and the title handler (which returns empty) wins.
 */
const GB_TITLE_PREFIX = "https://www.googleapis.com/books/v1/volumes?q=";
const GB_ISBN_PREFIX = "https://www.googleapis.com/books/v1/volumes?q=isbn%3A";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

describe("searchBooksServer — cover fallback chain", () => {
  it("upgrades a no-cover BN result via GB-by-ISBN second source", async () => {
    // BN returns a real record but its API doesn't expose a cover_url.
    // GB has no match for the title query, so the initial sources leave
    // the result without a cover. The second-source pass then asks GB
    // by ISBN directly — which returns a thumbnail.
    mockFetchByUrl({
      [GB_TITLE_PREFIX]: () =>
        // Title query — GB returns no items.
        jsonResponse({ totalItems: 0, items: [] }),
      [GB_ISBN_PREFIX]: () =>
        // ISBN query — GB returns a single item with a thumbnail.
        jsonResponse({
          totalItems: 1,
          items: [
            {
              id: "gb-1",
              volumeInfo: {
                title: "Wiedźmin",
                authors: ["Andrzej Sapkowski"],
                industryIdentifiers: [{ type: "ISBN_13", identifier: "9788375780630" }],
                imageLinks: {
                  thumbnail: "http://books.google.com/img?zoom=1&id=gb-1&edge=curl",
                },
              },
            },
          ],
        }),
      "https://openlibrary.org/search.json": () => jsonResponse({ numFound: 0, docs: [] }),
      "https://data.bn.org.pl/api/institutions/bibs.json": () =>
        jsonResponse({
          bibs: [
            {
              id: 1,
              title: "Wiedźmin / Andrzej Sapkowski.",
              author: "Sapkowski, Andrzej (1948- ).",
              isbnIssn: "9788375780630",
              language: "pol",
            },
          ],
        }),
    });

    const results = await searchBooksServer("Wiedźmin");
    assert.equal(results.length, 1);
    // The cover URL should be the GB upscaled (zoom=2, https) variant —
    // NOT the OL ISBN URL. That's the second-source upgrade.
    assert.match(results[0]!.cover_url ?? "", /^https:\/\/books\.google\.com\/img\?zoom=2/);
    assert.doesNotMatch(results[0]!.cover_url ?? "", /edge=curl/);
  });

  it("falls back to OL ISBN URL when GB-by-ISBN is empty", async () => {
    // BN result with ISBN, no GB cover from either title or ISBN lookup.
    // The OL ISBN URL stays as the final 404-graceful fallback.
    mockFetchByUrl({
      [GB_TITLE_PREFIX]: () => jsonResponse({ totalItems: 0, items: [] }),
      [GB_ISBN_PREFIX]: () => jsonResponse({ totalItems: 0, items: [] }),
      "https://openlibrary.org/search.json": () => jsonResponse({ numFound: 0, docs: [] }),
      "https://data.bn.org.pl/api/institutions/bibs.json": () =>
        jsonResponse({
          bibs: [
            {
              id: 2,
              title: "Lalka",
              author: "Prus, Bolesław",
              isbnIssn: "9788373270195",
              language: "pol",
            },
          ],
        }),
    });

    const results = await searchBooksServer("Lalka");
    assert.equal(results.length, 1);
    assert.equal(
      results[0]!.cover_url,
      "https://covers.openlibrary.org/b/isbn/9788373270195-L.jpg?default=false",
    );
  });

  it("leaves a result with no ISBN and no cover untouched (gradient placeholder path)", async () => {
    mockFetchByUrl({
      [GB_TITLE_PREFIX]: () => jsonResponse({ items: [] }),
      "https://openlibrary.org/search.json": () => jsonResponse({ docs: [] }),
      "https://data.bn.org.pl/api/institutions/bibs.json": () =>
        jsonResponse({
          bibs: [
            // No isbnIssn → BN result has no ISBN.
            { id: 3, title: "Mysterious Tome", author: "Anonymous" },
          ],
        }),
    });

    const results = await searchBooksServer("mystery");
    assert.equal(results.length, 1);
    assert.equal(results[0]!.cover_url, undefined);
  });

  it("upgrades an existing OL cover with a sharper GB-by-ISBN image", async () => {
    // Regression for the cover-quality bug (2026-06-24): before the
    // fix, `enrichCover` short-circuited on any existing `cover_url`,
    // so an OL `-L.jpg` (~500px) won even when GB had a `zoom=2`
    // (~800px) thumbnail for the same ISBN. The user kept seeing the
    // smaller image on the search page even though a sharper one was
    // available. Now GB wins when both sources carry a cover.
    mockFetchByUrl({
      [GB_TITLE_PREFIX]: () => jsonResponse({ totalItems: 0, items: [] }),
      [GB_ISBN_PREFIX]: () =>
        jsonResponse({
          totalItems: 1,
          items: [
            {
              id: "gb-1",
              volumeInfo: {
                title: "Wiedźmin",
                authors: ["Andrzej Sapkowski"],
                industryIdentifiers: [{ type: "ISBN_13", identifier: "9788375780630" }],
                imageLinks: {
                  thumbnail: "http://books.google.com/img?zoom=1&id=gb-1&edge=curl",
                },
              },
            },
          ],
        }),
      // OL search.json returns a doc with cover_i — gives us the
      // existing OL cover URL that the upgrade path should override.
      "https://openlibrary.org/search.json": () =>
        jsonResponse({
          numFound: 1,
          docs: [
            {
              key: "/works/OL1W",
              title: "Wiedźmin",
              author_name: ["Andrzej Sapkowski"],
              isbn: ["9788375780630"],
              cover_i: 12345,
            },
          ],
        }),
      "https://data.bn.org.pl/api/institutions/bibs.json": () => jsonResponse({ bibs: [] }),
    });

    const results = await searchBooksServer("Wiedźmin");
    assert.equal(results.length, 1);
    // GB upgrade wins — the existing OL `covers/b/id/...` URL is replaced
    // with the GB `zoom=2` (https-upgraded) variant.
    assert.match(results[0]!.cover_url ?? "", /^https:\/\/books\.google\.com\/img\?zoom=2/);
    assert.doesNotMatch(results[0]!.cover_url ?? "", /edge=curl/);
    assert.doesNotMatch(results[0]!.cover_url ?? "", /covers\.openlibrary\.org/);
  });
});

describe("lookupByIsbnServer — cover fallback chain", () => {
  it("upgrades the OL result with a GB-by-ISBN cover when OL has no cover_i", async () => {
    // OL `/isbn/<ISBN>.json` has `covers: []` (no cover_i) → `cover_url`
    // is undefined. GB-by-ISBN returns a thumbnail. Second source wins.
    mockFetchByUrl({
      "https://openlibrary.org/isbn/9788375780630.json": () =>
        jsonResponse({
          title: "Wiedźmin",
          authors: [{ key: "/authors/OL1A" }],
          covers: [], // no cover_i — empty array
          publishers: ["superNOWA"],
          number_of_pages: 350,
        }),
      "https://openlibrary.org/authors/OL1A.json": () =>
        jsonResponse({ name: "Andrzej Sapkowski" }),
      "https://www.googleapis.com/books/v1/volumes?q=isbn%3A9788375780630": () =>
        jsonResponse({
          totalItems: 1,
          items: [
            {
              id: "gb-1",
              volumeInfo: {
                title: "Wiedźmin",
                authors: ["Andrzej Sapkowski"],
                industryIdentifiers: [{ type: "ISBN_13", identifier: "9788375780630" }],
                imageLinks: { thumbnail: "http://books.google.com/img?zoom=1&id=gb-1" },
              },
            },
          ],
        }),
      "https://data.bn.org.pl/api/institutions/bibs.json": () => jsonResponse({ bibs: [] }),
    });

    const result = await lookupByIsbnServer("9788375780630");
    assert.ok(result);
    assert.match(result!.cover_url ?? "", /^https:\/\/books\.google\.com\/img\?zoom=2/);
  });

  it("falls back to OL ISBN cover URL when GB is unreachable", async () => {
    // OL has no cover_i, and GB fetch throws (network blip). The OL
    // ISBN URL must still be set — BookCover's onError will catch the
    // eventual 404 and show the gradient.
    mockFetchByUrl({
      "https://openlibrary.org/isbn/9788375780630.json": () =>
        jsonResponse({
          title: "Wiedźmin",
          authors: [{ key: "/authors/OL1A" }],
          covers: [],
        }),
      "https://openlibrary.org/authors/OL1A.json": () => jsonResponse({ name: "Sapkowski" }),
      "https://www.googleapis.com/books/v1/volumes?q=isbn%3A9788375780630": () => {
        throw new Error("ETIMEDOUT");
      },
      "https://data.bn.org.pl/api/institutions/bibs.json": () => jsonResponse({ bibs: [] }),
    });

    const result = await lookupByIsbnServer("9788375780630");
    assert.ok(result);
    // The OL ISBN URL stays even when GB throws — defensive against
    // network blips so the user always has SOMETHING to render.
    assert.equal(
      result!.cover_url,
      "https://covers.openlibrary.org/b/isbn/9788375780630-L.jpg?default=false",
    );
  });

  it("upgrades an existing OL cover with a sharper GB-by-ISBN image", async () => {
    // Regression for the cover-quality bug (2026-06-24): OL `/isbn/<ISBN>`
    // returns a `cover_i`, producing a `covers.openlibrary.org/b/id/...-L.jpg`
    // URL. GB-by-ISBN has a `zoom=2` thumbnail for the same ISBN. The GB
    // image should win — without downgrading to the OL ISBN URL when GB
    // also has no cover.
    mockFetchByUrl({
      "https://openlibrary.org/isbn/9788375780630.json": () =>
        jsonResponse({
          title: "Wiedźmin",
          authors: [{ key: "/authors/OL1A" }],
          covers: [12345], // OL has a cover → existing OL URL
        }),
      "https://openlibrary.org/authors/OL1A.json": () =>
        jsonResponse({ name: "Andrzej Sapkowski" }),
      "https://www.googleapis.com/books/v1/volumes?q=isbn%3A9788375780630": () =>
        jsonResponse({
          totalItems: 1,
          items: [
            {
              id: "gb-1",
              volumeInfo: {
                title: "Wiedźmin",
                authors: ["Andrzej Sapkowski"],
                industryIdentifiers: [{ type: "ISBN_13", identifier: "9788375780630" }],
                imageLinks: { thumbnail: "http://books.google.com/img?zoom=1&id=gb-1" },
              },
            },
          ],
        }),
      "https://data.bn.org.pl/api/institutions/bibs.json": () => jsonResponse({ bibs: [] }),
    });

    const result = await lookupByIsbnServer("9788375780630");
    assert.ok(result);
    // GB upgrade wins — the existing OL `covers/b/id/...` URL is replaced.
    assert.match(result!.cover_url ?? "", /^https:\/\/books\.google\.com\/img\?zoom=2/);
    assert.doesNotMatch(result!.cover_url ?? "", /covers\.openlibrary\.org/);
  });

  it("keeps the existing OL cover when GB has no image for the ISBN", async () => {
    // OL has a `cover_i`, GB returns `imageLinks` empty. Don't downgrade
    // the working OL cover to the OL ISBN URL (which would 404 anyway).
    mockFetchByUrl({
      "https://openlibrary.org/isbn/9788375780630.json": () =>
        jsonResponse({
          title: "Wiedźmin",
          authors: [{ key: "/authors/OL1A" }],
          covers: [12345],
        }),
      "https://openlibrary.org/authors/OL1A.json": () =>
        jsonResponse({ name: "Andrzej Sapkowski" }),
      "https://www.googleapis.com/books/v1/volumes?q=isbn%3A9788375780630": () =>
        jsonResponse({
          totalItems: 1,
          items: [
            {
              id: "gb-1",
              volumeInfo: {
                title: "Wiedźmin",
                authors: ["Andrzej Sapkowski"],
                industryIdentifiers: [{ type: "ISBN_13", identifier: "9788375780630" }],
                // No imageLinks.
              },
            },
          ],
        }),
      "https://data.bn.org.pl/api/institutions/bibs.json": () => jsonResponse({ bibs: [] }),
    });

    const result = await lookupByIsbnServer("9788375780630");
    assert.ok(result);
    assert.match(
      result!.cover_url ?? "",
      /^https:\/\/covers\.openlibrary\.org\/b\/id\/12345-L\.jpg/,
    );
  });
});
