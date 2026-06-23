// cover-url.ts — small, pure helpers for picking the right cover variant
// for a given render size. Imported by `BookCover.tsx` and the
// search-result cards so the wire size matches the displayed size.
//
// Two CDN families are recognised:
//   - covers.openlibrary.org (id/olid/isbn → -S / -M / -L jpg variants)
//   - books.google.com (zoom=1 ≈ 100px, zoom=2 ≈ 200px, zoom=3-5 ≈ 400-1280px)
//
// Everything else falls through to `undefined` so the caller can use
// `cover_url` as-is (or render the gradient fallback).

export type CoverSize = "sm" | "md" | "lg" | "xl";

// CSS sizes (matches the `sizes` map in `BookCover.tsx`).
// `sizes` is what the browser uses to pick from `srcset`; the attribute must
// be in CSS pixels and reflect the layout, not the underlying image.
const SIZE_CSS_PX: Record<CoverSize, string> = {
  sm: "80px",
  md: "120px",
  lg: "144px",
  xl: "192px",
};

// A responsive hint for grid layouts: covers sit in a flex/grid column
// that on narrow viewports is full-width (≈100vw) and on wider ones is
// constrained to the column. The browser picks the best srcset entry.
function sizeAttr(size: CoverSize): string {
  const px = SIZE_CSS_PX[size];
  // `(max-width: 640px) 50vw` covers the case where two covers sit side-by-side
  // on a phone (e.g. recommendation carousels). On larger viewports, the
  // `px` hint matches the column width closely enough.
  return `(max-width: 640px) 50vw, ${px}`;
}

const SIZE_CSS_PX_NUM: Record<CoverSize, number> = {
  sm: 80,
  md: 120,
  lg: 144,
  xl: 192,
};

// ---- Open Library ---------------------------------------------------------

// `/b/id/{id}-{S|M|L}.jpg?default=false`
//   S ≈ 64×96  (rarely useful)
//   M ≈ 96×144
//   L ≈ 192×288
const OL_RE =
  /^(https?:\/\/covers\.openlibrary\.org\/b\/(?:id|olid|isbn)\/[^?]+)-L(\.jpg(?:\?.*)?)$/;

function rewriteOL(url: string, size: CoverSize): string | undefined {
  const m = url.match(OL_RE);
  if (!m) return undefined;
  const [, base, suffix] = m;
  // For sm/md prefer M, but only on the `/id/` path — ISBN/olid endpoints
  // return a single -L jpeg so there's no benefit to switching.
  if (url.includes("/b/id/")) {
    const variant = size === "sm" || size === "md" ? "M" : "L";
    return `${base}-${variant}${suffix}`;
  }
  return size === "sm" || size === "md" ? undefined : url;
}

function olSrcset(url: string, size: CoverSize): string | undefined {
  // Only id-based URLs have multiple variants; ISBN/olid do not.
  if (!url.includes("/b/id/")) return undefined;
  const m = url.match(OL_RE);
  if (!m) return undefined;
  const [, base, suffix] = m;
  // Cap at the L variant — OL doesn't serve higher.
  const target = size === "sm" || size === "md" ? "M" : "L";
  return [`${base}-${target}${suffix} 1x`, `${base}-L${suffix} 2x`].join(", ");
}

// ---- Google Books ---------------------------------------------------------

// `https://books.google.com/books/content?...&zoom=N&edge=curl&...`
//   zoom=1 ≈ 100 px wide thumbnail
//   zoom=2 ≈ 200 px
//   zoom=3 ≈ 400 px
//   zoom=5 (default thumb) ≈ 1280 px (overkill for a 192px CSS cover)
// `&edge=curl` triggers a fancy curved-edge rendering that looks bad at
// small sizes and is slow; strip it.
const GB_RE = /^(https?:\/\/books\.google\.com\/books\/content\?[^]+)$/;

function rewriteGB(url: string, size: CoverSize): string | undefined {
  const m = url.match(GB_RE);
  if (!m) return undefined;
  let u = m[1].replace(/^http:\/\//, "https://");
  // Strip any pre-existing zoom first.
  u = u.replace(/([?&])zoom=\d+/g, "");
  const zoom = size === "sm" || size === "md" ? "1" : "2";
  u += (u.includes("?") ? "&" : "?") + `zoom=${zoom}`;
  u = u.replace(/([?&])edge=curl/g, "");
  // Collapse double `?&` if we just stripped the first param.
  u = u.replace(/\?&/, "?").replace(/&&+/g, "&");
  return u;
}

function gbSrcset(url: string, size: CoverSize): string | undefined {
  const m = url.match(GB_RE);
  if (!m) return undefined;
  // For sm/md the 1x is zoom=1 (~100px), 2x is zoom=2 (~200px).
  // For lg/xl the 1x is zoom=2 (~200px), 2x is zoom=3 (~400px).
  const base = m[1].replace(/^http:\/\//, "https://").replace(/([?&])zoom=\d+/g, "");
  const cleaned = base.replace(/([?&])edge=curl/g, "");
  const sep = cleaned.includes("?") ? "&" : "?";
  const collapsed = (cleaned + sep).replace(/\?&/, "?").replace(/&&+/g, "&");
  if (size === "sm" || size === "md") {
    return [`${collapsed}zoom=1 1x`, `${collapsed}zoom=2 2x`].join(", ");
  }
  return [`${collapsed}zoom=2 1x`, `${collapsed}zoom=3 2x`].join(", ");
}

// ---- Public API -----------------------------------------------------------

/**
 * Pick the best cover URL for a given render size. Returns `undefined` when
 * the URL doesn't match a known CDN (caller falls back to as-is or the
 * gradient placeholder).
 */
export function pickCoverUrl(url: string | undefined, size: CoverSize): string | undefined {
  if (!url) return undefined;
  return rewriteOL(url, size) ?? rewriteGB(url, size) ?? url;
}

/**
 * Build a `srcset` string for the given URL at the given size, suitable
 * for a `<img srcset>` attribute. Returns `undefined` when the source CDN
 * doesn't expose multiple variants (so the browser uses the bare `src`).
 */
export function coverSrcset(url: string | undefined, size: CoverSize): string | undefined {
  if (!url) return undefined;
  return olSrcset(url, size) ?? gbSrcset(url, size);
}

/** A `sizes` attribute for the given render size. */
export { sizeAttr };

/** Re-export for tests / type-checkers that want a numeric size. */
export const coverSizePx = SIZE_CSS_PX_NUM;
