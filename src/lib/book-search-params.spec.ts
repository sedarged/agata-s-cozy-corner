// book-search-params.spec.ts — TDD for the params + pagination helpers
// added to /api/book-search.
//
// Pure functions, no fetch. The route will import these and use them
// for validation before hitting the upstream cache layer.

import { test } from "node:test";
import assert from "node:assert/strict";
import {
  parseSearchParams,
  paginate,
  MAX_PAGE_SIZE,
  DEFAULT_PAGE_SIZE,
  type SearchParams,
} from "./book-search-params";

test("parseSearchParams: missing both q and isbn returns 400-shaped error", () => {
  const r = parseSearchParams(new URLSearchParams(""));
  assert.equal(r.ok, false);
  if (!r.ok) assert.match(r.error, /q.*isbn|Provide/);
});

test("parseSearchParams: empty q is treated as missing", () => {
  const r = parseSearchParams(new URLSearchParams("q="));
  assert.equal(r.ok, false);
});

test("parseSearchParams: trims q", () => {
  const r = parseSearchParams(new URLSearchParams("q=%20%20wiedzmin%20%20"));
  assert.equal(r.ok, true);
  if (r.ok) assert.equal(r.params.q, "wiedzmin");
});

test("parseSearchParams: source accepts comma-separated list and dedupes", () => {
  const r = parseSearchParams(new URLSearchParams("q=x&source=openlibrary,google,google,bn"));
  assert.equal(r.ok, true);
  if (r.ok) {
    assert.deepEqual(r.params.sources, ["openlibrary", "google", "bn"]);
  }
});

test("parseSearchParams: invalid source values are dropped silently", () => {
  const r = parseSearchParams(new URLSearchParams("q=x&source=openlibrary,nope,google"));
  assert.equal(r.ok, true);
  if (r.ok) {
    assert.deepEqual(r.params.sources, ["openlibrary", "google"]);
  }
});

test("parseSearchParams: pageSize is clamped to MAX_PAGE_SIZE", () => {
  const r = parseSearchParams(new URLSearchParams("q=x&pageSize=99999"));
  assert.equal(r.ok, true);
  if (r.ok) assert.equal(r.params.pageSize, MAX_PAGE_SIZE);
});

test("parseSearchParams: page is 1-based, negative coerced to 1", () => {
  const r = parseSearchParams(new URLSearchParams("q=x&page=-5"));
  assert.equal(r.ok, true);
  if (r.ok) assert.equal(r.params.page, 1);
});

test("parseSearchParams: defaults when no params", () => {
  const r = parseSearchParams(new URLSearchParams("q=wiedzmin"));
  assert.equal(r.ok, true);
  if (r.ok) {
    assert.equal(r.params.q, "wiedzmin");
    assert.equal(r.params.page, 1);
    assert.equal(r.params.pageSize, DEFAULT_PAGE_SIZE);
    assert.equal(r.params.sources, undefined);
    assert.equal(r.params.isbn, undefined);
  }
});

test("parseSearchParams: isbn takes priority over q when both are present", () => {
  const r = parseSearchParams(new URLSearchParams("q=x&isbn=9780201616224"));
  assert.equal(r.ok, true);
  if (r.ok) {
    assert.equal(r.params.isbn, "9780201616224");
    assert.equal(r.params.q, "x");
  }
});

test("paginate: slices correctly with page=1, pageSize=5", () => {
  const out = paginate([1, 2, 3, 4, 5, 6, 7], 1, 5);
  assert.deepEqual(out.items, [1, 2, 3, 4, 5]);
  assert.equal(out.total, 7);
  assert.equal(out.page, 1);
  assert.equal(out.pageSize, 5);
  assert.equal(out.hasMore, true);
});

test("paginate: page 2 returns the next slice and hasMore=false on last page", () => {
  const out = paginate([1, 2, 3, 4, 5, 6, 7], 2, 5);
  assert.deepEqual(out.items, [6, 7]);
  assert.equal(out.hasMore, false);
});

test("paginate: page beyond end returns empty slice and hasMore=false", () => {
  const out = paginate([1, 2, 3], 5, 5);
  assert.deepEqual(out.items, []);
  assert.equal(out.hasMore, false);
  assert.equal(out.total, 3);
});

test("paginate: full result when pageSize >= total", () => {
  const out = paginate([1, 2, 3], 1, 100);
  assert.deepEqual(out.items, [1, 2, 3]);
  assert.equal(out.hasMore, false);
});

test("SearchParams: type allows undefined sources (means: all sources)", () => {
  // Compile-time check. If a regression makes sources required, this fails.
  const p: SearchParams = { q: "x", page: 1, pageSize: 20 };
  assert.equal(p.q, "x");
});
