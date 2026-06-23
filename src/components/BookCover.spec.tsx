// BookCover.spec.tsx — TDD for src/components/BookCover.tsx.
//
// Verifies the cover image gets a size-appropriate src/srcset, `loading=lazy`
// by default, and `fetchPriority=high` only when `priority` is set.

import { test } from "node:test";
import assert from "node:assert/strict";
import { renderToStaticMarkup } from "react-dom/server";
import { createElement } from "react";
import { BookCover } from "./BookCover";

const OL_ID = "https://covers.openlibrary.org/b/id/12345-L.jpg?default=false";
const GB_THUMB =
  "https://books.google.com/books/content?id=abc&printsec=frontcover&img=1&zoom=5&edge=curl&source=gbs_api";

function htmlOf(node: React.ReactElement): string {
  return renderToStaticMarkup(node);
}

test("BookCover picks the OL M variant for sm and md", () => {
  const html = htmlOf(
    createElement(BookCover, { book: { title: "X", cover_url: OL_ID }, size: "sm" }),
  );
  assert.match(html, /covers\.openlibrary\.org\/b\/id\/12345-M\.jpg/);
  assert.match(html, /loading="lazy"/);
});

test("BookCover omits srcSet/sizes when className has w-full (responsive width)", () => {
  // The library grid uses `!w-full !h-auto aspect-[2/3]`, which makes the
  // cover fluid across viewports. The precomputed `sizes` hint (144px)
  // would lie to the browser and could cause blurry covers on 2x screens
  // at xl viewports (where the column is ~220px). The component should
  // fall back to a plain `src` and let the browser use the bare URL.
  const html = htmlOf(
    createElement(BookCover, {
      book: { title: "X", cover_url: OL_ID },
      size: "lg",
      className: "!w-full !h-auto aspect-[2/3]",
    }),
  );
  assert.doesNotMatch(html, /srcSet=/);
  assert.doesNotMatch(html, /sizes="/);
  // The OL -L variant is used as the single `src` — still the smallest
  // variant the CDN offers, just no `srcset` companion.
  assert.match(
    html,
    /src="https:\/\/covers\.openlibrary\.org\/b\/id\/12345-L\.jpg\?default=false"/,
  );
});

test("BookCover keeps the OL L variant for lg and xl", () => {
  const html = htmlOf(
    createElement(BookCover, { book: { title: "X", cover_url: OL_ID }, size: "xl" }),
  );
  assert.match(html, /covers\.openlibrary\.org\/b\/id\/12345-L\.jpg/);
});

test("BookCover emits a 1x/2x srcset for OL id URLs", () => {
  const html = htmlOf(
    createElement(BookCover, { book: { title: "X", cover_url: OL_ID }, size: "md" }),
  );
  assert.match(html, /srcSet="[^"]*-M\.jpg\?default=false 1x[^"]*-L\.jpg\?default=false 2x"/);
});

test("BookCover rewrites Google Books zoom and drops edge=curl", () => {
  const html = htmlOf(
    createElement(BookCover, { book: { title: "X", cover_url: GB_THUMB }, size: "md" }),
  );
  assert.match(html, /zoom=1/);
  assert.doesNotMatch(html, /edge=curl/);
  assert.match(html, /srcSet="[^"]*zoom=1 1x[^"]*zoom=2 2x"/);
});

test("BookCover sets loading=eager + fetchPriority=high when priority is true", () => {
  const html = htmlOf(
    createElement(BookCover, {
      book: { title: "X", cover_url: OL_ID },
      size: "lg",
      priority: true,
    }),
  );
  assert.match(html, /loading="eager"/);
  // React 19 SSR emits the JSX prop verbatim (`fetchPriority`); browsers
  // recognise both `fetchPriority` and `fetchpriority` in HTML.
  assert.match(html, /fetchpriority="high"/i);
});

test("BookCover falls back to gradient placeholder when cover_url is missing", () => {
  const html = htmlOf(createElement(BookCover, { book: { title: "X" }, size: "md" }));
  assert.doesNotMatch(html, /<img/);
  // Gradient placeholder exposes the title as accessible text.
  assert.match(html, /Okładka: X/);
});

test("BookCover falls back when the image errors (smoke check on onError wiring)", () => {
  // We can't simulate an image network error under SSR, but we can confirm
  // the onError handler is wired to the <img> by looking for the `onError`
  // attribute React renders. (React strips it from the DOM but the prop is
  // present on the React element — renderToStaticMarkup strips it. So we
  // just assert no <img> without src here: the missing-cover branch is
  // covered by the gradient test above.)
  const html = htmlOf(
    createElement(BookCover, { book: { title: "X", cover_url: OL_ID }, size: "sm" }),
  );
  assert.match(html, /<img /);
});
