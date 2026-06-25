// book-search-query.spec.ts — TDD for the fielded-query router.
//
// The /search box on /add-book currently ships whatever the user typed
// straight to the upstream APIs as a full-text query. For ISBN-shaped
// input that means GB/OL fall back to a fuzzy keyword search instead
// of an exact lookup, which (a) misses the record entirely for short
// queries like "Harry", and (b) wastes a quota unit on results that
// are not the book the user is holding.
//
// Both Google Books and Open Library support structured query
// keywords — `isbn:`, `intitle:`, `inauthor:` on GB; `isbn:`, `title=`,
// `author=` on OL. `routeQuery` detects the shape of the input and
// returns a per-API query string that uses the right keyword so the
// upstream returns the correct record with full metadata (subjects,
// description, page count) instead of a fuzzy-matching no-match.
//
// Pure function — no fetch, no DB. Pinned so future regressions in
// book-search.server.ts can't quietly drop the fielded routing.

import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { routeQuery, type RoutedQueries } from "./book-search-query";

describe("routeQuery — ISBN detection", () => {
  test("10-digit ISBN with hyphens gets routed as isbn: keyword to both APIs", () => {
    const out = routeQuery("0-306-40615-2");
    assert.equal(out.kind, "isbn");
    assert.equal(out.google, "isbn:0306406152");
    assert.equal(out.openlibrary, "isbn:0306406152");
    assert.equal(out.bn, "0306406152");
  });

  test("13-digit ISBN keeps the fielded keyword on both APIs", () => {
    const out = routeQuery("978-83-7327-192-0");
    assert.equal(out.kind, "isbn");
    assert.equal(out.google, "isbn:9788373271920");
    assert.equal(out.openlibrary, "isbn:9788373271920");
    assert.equal(out.bn, "9788373271920");
  });

  test("X-allowed ISBN10 is preserved", () => {
    // ISBN-10 may end in X (e.g. 080442957X for a classic OOP text).
    const out = routeQuery("080442957X");
    assert.equal(out.kind, "isbn");
    assert.equal(out.google, "isbn:080442957X");
    assert.equal(out.openlibrary, "isbn:080442957X");
    assert.equal(out.bn, "080442957X");
  });

  test("ISBN with periods (e.g. from a pasted citation) still gets routed as isbn:", () => {
    // Real users paste ISBNs from various sources — periods, slashes,
    // NBSPs are all common. The cleaner strips everything that isn't
    // a digit or X so any of these still hit the exact-ISBN path
    // instead of falling through to a useless free-text title search.
    const out = routeQuery("978.83.7327.192.0");
    assert.equal(out.kind, "isbn");
    assert.equal(out.google, "isbn:9788373271920");
    assert.equal(out.bn, "9788373271920");
  });

  test("empty string yields empty queries (caller short-circuits earlier)", () => {
    const out = routeQuery("");
    assert.equal(out.kind, "unknown");
    assert.equal(out.google, "");
    assert.equal(out.openlibrary, "");
    assert.equal(out.bn, "");
  });

  test("ISBN-13 with bad check digit falls through to free text (no upstream waste)", () => {
    // 9780306406150 has the same body as 9780306406157 (Effective Java,
    // ISBN-10 0-306-40615-2) but the wrong check digit (0 instead of 7).
    // Previously this would route to isbn:9780306406150 across all three
    // upstreams, returning 0-result pages and burning a quota unit per
    // source — visibly the same UX as no input but invisible in logs.
    // Correct: detectIsbn's mod-10 check should reject it.
    const out = routeQuery("9780306406150");
    assert.notEqual(out.kind, "isbn", "bad check digit must not pass as ISBN");
  });

  test("ISBN-13 with valid check digit (9780306406157) routes as isbn:", () => {
    // Effective Java — check digit 7. Verify the mod-10 check accepts it.
    const out = routeQuery("9780306406157");
    assert.equal(out.kind, "isbn");
    assert.equal(out.google, "isbn:9780306406157");
  });
});

describe("routeQuery — title detection (intitle / title=)", () => {
  test("a single all-lowercase title word triggers intitle: on GB and title= on OL", () => {
    const out = routeQuery("wiedźmin");
    assert.equal(out.kind, "title");
    assert.equal(out.google, "intitle:wiedźmin");
    assert.equal(out.openlibrary, "title=wiedźmin");
    // BN doesn't support a title= keyword, fall back to free text.
    assert.equal(out.bn, "wiedźmin");
  });

  test("a single Capitalized token (likely author surname) stays free text", () => {
    // Regression guard: routing "Sapkowski" to intitle: would zero out
    // GB's author-field ranking and miss every book by Andrzej Sapkowski.
    // Free text lets the upstream's full-text engine rank by relevance
    // across title + author + subject.
    const out = routeQuery("Sapkowski");
    assert.equal(out.kind, "free");
    assert.equal(out.google, "Sapkowski");
    assert.equal(out.openlibrary, "Sapkowski");
    assert.equal(out.bn, "Sapkowski");
  });

  test("a single Capitalized token with diacritics stays free text", () => {
    // Polish surnames like "Sienkiewicz", "Miłoszewski" must stay free.
    const out = routeQuery("Sienkiewicz");
    assert.equal(out.kind, "free");
    assert.equal(out.bn, "Sienkiewicz");
  });

  test("multi-word title preserves spaces in the fielded keyword", () => {
    const out = routeQuery("Pan Tadeusz");
    assert.equal(out.kind, "title");
    assert.equal(out.google, "intitle:Pan Tadeusz");
    assert.equal(out.openlibrary, "title=Pan Tadeusz");
  });
});

describe("routeQuery — author detection (inauthor / author=)", () => {
  test("leading 'author:' prefix in user input is rewritten to inauthor:/author=", () => {
    const out = routeQuery("author: Sapkowski");
    assert.equal(out.kind, "author");
    assert.equal(out.google, "inauthor:Sapkowski");
    assert.equal(out.openlibrary, "author=Sapkowski");
  });
});

describe("routeQuery — free-text fallback", () => {
  test("5+ word search phrase is passed through as free text", () => {
    // Five words exceeds the title-promotion threshold — clearly a
    // search phrase ("best Polish fantasy novels of all time") not a
    // title. Free-text fallback so the upstream's full-text engine
    // (which weights title/author/subject itself) has more to work with.
    const out = routeQuery("best Polish fantasy novels of all time");
    assert.equal(out.kind, "free");
    assert.equal(out.google, "best Polish fantasy novels of all time");
    assert.equal(out.openlibrary, "best Polish fantasy novels of all time");
    assert.equal(out.bn, "best Polish fantasy novels of all time");
  });
});

describe("routeQuery — type guard", () => {
  test("returned shape has the three API-specific fields", () => {
    const out: RoutedQueries = routeQuery("Harry Potter");
    assert.ok("google" in out);
    assert.ok("openlibrary" in out);
    assert.ok("bn" in out);
    assert.ok("kind" in out);
  });
});
