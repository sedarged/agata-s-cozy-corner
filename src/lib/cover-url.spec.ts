// cover-url.spec.ts — TDD for src/lib/cover-url.ts.
//
// Pure helpers that turn a `BookSearchResult.cover_url` (Google Books imageLinks
// or Open Library covers CDN) into a smaller, sized variant for the requested
// render size. The point is to keep the wire size small: a sm 80×118 cover
// doesn't need the -L (≈400px) variant. A 2× DPR screen can pick the -L via
// srcset; a 1× screen gets the -M.

import { test } from "node:test";
import assert from "node:assert/strict";
import { coverSrcset, pickCoverUrl, sizeAttr, type CoverSize } from "./cover-url";

const OL_BY_ID = "https://covers.openlibrary.org/b/id/12345-L.jpg?default=false";
const OL_BY_OLID = "https://covers.openlibrary.org/b/olid/OL12345M-L.jpg?default=false";
const OL_BY_ISBN = "https://covers.openlibrary.org/b/isbn/9780201616224-L.jpg?default=false";
const GB_THUMB =
  "https://books.google.com/books/content?id=abc&printsec=frontcover&img=1&zoom=5&edge=curl&source=gbs_api";

test("pickCoverUrl: small sizes use Open Library M variant on /b/id/", () => {
  assert.equal(
    pickCoverUrl(OL_BY_ID, "sm"),
    "https://covers.openlibrary.org/b/id/12345-M.jpg?default=false",
  );
  assert.equal(
    pickCoverUrl(OL_BY_ID, "md"),
    "https://covers.openlibrary.org/b/id/12345-M.jpg?default=false",
  );
  // ISBN/olid endpoints only serve a single -L variant — keep the URL.
  // (Browser still gets `decoding=async` + the gradient fallback on error.)
  assert.equal(pickCoverUrl(OL_BY_ISBN, "md"), OL_BY_ISBN);
  assert.equal(pickCoverUrl(OL_BY_OLID, "sm"), OL_BY_OLID);
});

test("pickCoverUrl: lg/xl keep the L variant (covers up close to 200×300 CSS px)", () => {
  assert.equal(pickCoverUrl(OL_BY_ID, "lg"), OL_BY_ID);
  assert.equal(pickCoverUrl(OL_BY_ID, "xl"), OL_BY_ID);
});

test("pickCoverUrl: Google Books thumb gets zoom=1 for sm/md, zoom=2 for lg/xl", () => {
  const sm = pickCoverUrl(GB_THUMB, "sm")!;
  const lg = pickCoverUrl(GB_THUMB, "lg")!;
  assert.match(sm, /zoom=1/);
  assert.doesNotMatch(sm, /edge=curl/);
  assert.match(lg, /zoom=2/);
});

test("pickCoverUrl: forces https on Google Books http URLs", () => {
  const http = "http://books.google.com/books/content?id=x&img=1&zoom=1";
  const out = pickCoverUrl(http, "sm")!;
  assert.ok(out.startsWith("https://"), `expected https, got ${out}`);
});

test("pickCoverUrl: unknown hosts pass through unchanged", () => {
  // CDN-unknown URLs are returned as-is so the browser still tries them;
  // BookCover's onError handler falls back to the gradient placeholder.
  assert.equal(
    pickCoverUrl("https://example.com/cover.jpg", "md"),
    "https://example.com/cover.jpg",
  );
  assert.equal(pickCoverUrl(undefined, "md"), undefined);
});

test("coverSrcset: OL id URLs produce 1x/2x srcset with M and L", () => {
  const s = coverSrcset(OL_BY_ID, "md");
  assert.match(s!, /12345-M\.jpg\?default=false 1x/);
  assert.match(s!, /12345-L\.jpg\?default=false 2x/);
});

test("coverSrcset: ISBN/olid URLs fall back to 1x only (no -L variant served)", () => {
  // OL's ISBN/olid endpoints only serve a single size, so srcset is pointless.
  // We return undefined to let the browser pick the only available size.
  assert.equal(coverSrcset(OL_BY_ISBN, "md"), undefined);
  assert.equal(coverSrcset(OL_BY_OLID, "md"), undefined);
});

test("coverSrcset: Google Books produces 1x/2x srcset", () => {
  const s = coverSrcset(GB_THUMB, "md");
  assert.match(s!, /zoom=1 1x/);
  assert.match(s!, /zoom=2 2x/);
});

test("sizeAttr: maps size to CSS pixels for the `sizes` attribute", () => {
  assert.match(sizeAttr("sm"), /80px/);
  assert.match(sizeAttr("md"), /120px/);
  assert.match(sizeAttr("lg"), /144px/);
  assert.match(sizeAttr("xl"), /192px/);
  // Should also include a vw fallback for grid responsiveness.
  assert.match(sizeAttr("md"), /vw/);
});

test("CoverSize is exported as a type-only re-export of expected literals", () => {
  // Compile-time check: this test simply imports the union. If a regression
  // removed a member, typecheck on the spec file would fail.
  const sizes: CoverSize[] = ["sm", "md", "lg", "xl"];
  assert.equal(sizes.length, 4);
});
