// Pure mapper layer for Google Books, Open Library, and Biblioteka Narodowa
// search results. Lives outside the `server-only` book-search.server.ts
// module so the metadata-extraction contract is testable without a Nitro
// process. Every field that ends up in a BookSearchResult card on the
// /add-book page is shaped here — no fetch, no DB.
//
// What this module captures that Agata's UI actually consumes:
//   title, subtitle, authors[], first author, ISBN-10/13, cover URL,
//   description, page count, published date, category (subject[0]),
//   subjects[], publisher, language, ratings, preview / info / buy /
//   read-online URLs, edition count, first sentence, maturity rating.
//
// What this module adds vs. the prior inline mappers:
//   • GB `volumeInfo.dimensions` → `BookSearchResult.dimensions`
//   • GB `volumeInfo.printType` → `BookSearchResult.format`
//   • GB `readingModes.text` is checked together with previewLink so
//     read-online previews reach the UI even when viewability is
//     "PARTIAL" (previously only "ALL_PAGES" triggered a link).
//   • OL isbn endpoint `physical_format`, `isbn_13`, `isbn_10` (cleaner
//     ISBN split than OL search.json's `isbn[]` which can include
//     ISBN-10 of completely unrelated editions).
//
// Pinned by `book-search-mappers.spec.ts`.

import type { BookSearchResult } from "./book-search-types";

/** Subset of Google Books API `volumeInfo` we actually consume. */
export interface GBVolume {
  id: string;
  volumeInfo: {
    title?: string;
    subtitle?: string;
    authors?: string[];
    description?: string;
    pageCount?: number;
    publishedDate?: string;
    industryIdentifiers?: { type: string; identifier: string }[];
    imageLinks?: {
      thumbnail?: string;
      smallThumbnail?: string;
      small?: string;
      medium?: string;
      large?: string;
      extraLarge?: string;
    };
    categories?: string[];
    publisher?: string;
    language?: string;
    averageRating?: number;
    ratingsCount?: number;
    previewLink?: string;
    infoLink?: string;
    canonicalVolumeLink?: string;
    maturityRating?: string;
    /** Physical size string, e.g. "8.27 x 5.83 x 0.79 inches". */
    dimensions?: string;
    /** BOOK or MAGAZINE — surfaced as `format` for UI display. */
    printType?: string;
    /** Whether GB has a text snippet available for this volume. */
    readingModes?: { text?: boolean; image?: boolean };
  };
  saleInfo?: { buyLink?: string; saleability?: string };
  accessInfo?: { webReaderLink?: string; viewability?: string };
}

/**
 * Pick ISBN-10 and ISBN-13 out of GB's industryIdentifiers array, ignoring
 * ISSN / OTHER entries. `isbn` is the "best" canonical value — ISBN-13
 * wins when present (newer, more globally unique).
 */
export function pickIsbns(ids?: { type: string; identifier: string }[]): {
  isbn?: string;
  isbn10?: string;
  isbn13?: string;
} {
  if (!ids) return {};
  const i13 = ids.find((i) => i.type === "ISBN_13")?.identifier;
  const i10 = ids.find((i) => i.type === "ISBN_10")?.identifier;
  const out: { isbn?: string; isbn10?: string; isbn13?: string } = {};
  if (i13 || i10) out.isbn = i13 ?? i10;
  if (i13) out.isbn13 = i13;
  if (i10) out.isbn10 = i10;
  return out;
}

/**
 * Pick the largest Google Books cover variant available. GB returns up
 * to extraLarge in full projection, falling back to large → medium →
 * upscaled thumbnail. The `?zoom=2` query param on thumbnail variants
 * forces GB to serve a sharper 256×256-ish image instead of the 80×80
 * default. `&edge=curl` strips the cropping hint GB adds to some
 * thumbnails (which would otherwise crop the cover art).
 */
function upscaleGoogleCover(url?: string): string | undefined {
  if (!url) return undefined;
  let u = url.replace("http://", "https://");
  if (u.includes("zoom=")) u = u.replace(/zoom=\d/, "zoom=2");
  else u = u + (u.includes("?") ? "&" : "?") + "zoom=2";
  u = u.replace(/&edge=curl/, "");
  return u;
}

export function bestGoogleCover(info: GBVolume["volumeInfo"]): string | undefined {
  const il = info.imageLinks;
  if (!il) return undefined;
  return (
    il.extraLarge?.replace("http://", "https://") ||
    il.large?.replace("http://", "https://") ||
    il.medium?.replace("http://", "https://") ||
    upscaleGoogleCover(il.thumbnail) ||
    upscaleGoogleCover(il.smallThumbnail)
  );
}

/** Map a single Google Books volume into a BookSearchResult. */
export function mapGoogleVolume(v: GBVolume): BookSearchResult {
  const info = v.volumeInfo;
  const ids = pickIsbns(info.industryIdentifiers);
  return {
    source: "google",
    external_id: v.id,
    title: info.title ?? "Brak tytułu",
    subtitle: info.subtitle,
    author: info.authors?.[0] ?? "Brak autora",
    authors: info.authors,
    isbn: ids.isbn,
    isbn10: ids.isbn10,
    isbn13: ids.isbn13,
    cover_url: bestGoogleCover(info),
    description: info.description,
    page_count: info.pageCount,
    published_date: info.publishedDate,
    category: info.categories?.[0],
    subjects: info.categories,
    publisher: info.publisher,
    language: info.language?.toLowerCase(),
    rating: info.averageRating,
    ratings_count: info.ratingsCount,
    preview_url: info.previewLink,
    info_url: info.infoLink ?? info.canonicalVolumeLink,
    buy_url: v.saleInfo?.buyLink,
    // Old rule: read_online_url ONLY when viewability === ALL_PAGES.
    // New rule (2026-06-25): also surface the web reader link when GB
    // has a text snippet available AND the volume is previewable.
    // PARTIAL viewability covers far more books than ALL_PAGES, so
    // this unlocks a real "Czytaj fragment" link for most volumes that
    // have any preview.
    read_online_url:
      v.accessInfo?.viewability === "ALL_PAGES"
        ? v.accessInfo?.webReaderLink
        : info.readingModes?.text && info.previewLink
          ? info.previewLink
          : undefined,
    maturity_rating: info.maturityRating,
    dimensions: info.dimensions,
    format: info.printType,
  };
}

// ----- Open Library: ISBN endpoint type -----

/**
 * Subset of Open Library's `https://openlibrary.org/isbn/{isbn}.json`
 * response that we use. Distinct from OL search.json's `OLDoc` because
 * the ISBN endpoint returns a single Edition (physical book) record
 * with `physical_format`, explicit `isbn_13` / `isbn_10` arrays, and
 * the canonical `publishers` array — none of which appear on search
 * results.
 */
export interface OLIsbnEdition {
  title: string;
  subtitle?: string;
  authors?: { key: string }[];
  number_of_pages?: number;
  publish_date?: string;
  publishers?: string[];
  covers?: number[];
  subjects?: string[];
  description?: string | { value: string };
  languages?: { key: string }[];
  works?: { key: string }[];
  physical_format?: string;
  physical_dimensions?: string;
  weight?: string;
  isbn_13?: string[];
  isbn_10?: string[];
}

/** Pick a clean ISBN-13 / ISBN-10 pair from OL isbn endpoint fields. */
export function pickOlIsbns(d: OLIsbnEdition): {
  isbn?: string;
  isbn13?: string;
  isbn10?: string;
} {
  const i13 = d.isbn_13?.[0];
  const i10 = d.isbn_10?.[0];
  const out: { isbn?: string; isbn13?: string; isbn10?: string } = {};
  if (i13 || i10) out.isbn = i13 ?? i10;
  if (i13) out.isbn13 = i13;
  if (i10) out.isbn10 = i10;
  return out;
}
