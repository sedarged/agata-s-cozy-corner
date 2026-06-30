// Agata — social-proof / reader-review provider.
// Server-only module that fetches public reader ratings + reviews from
// Hardcover (preferred) and falls back to a deterministic mock when
// `HARDCOVER_TOKEN` is unset. The mock keeps the UI populated in dev/test
// without leaking "we have no real data" empty states — and without
// inventing Goodreads scrapes (the spec explicitly forbids that).
//
// This file is server-only: the `server-only` marker means a client import
// will fail at build time, which is what we want (we don't expose the
// Hardcover bearer token to the browser).
import "@tanstack/react-start/server-only";

// ---------- public DTO ----------
// Mirrors the spec's BookSocialProofDTO. The route layer (`/api/books/:id/
// social-proof`) returns exactly this shape.
export interface BookSocialProofDTO {
  bookId: string;

  averageRating?: number;
  ratingsCount?: number;
  reviewsCount?: number;

  ratingDistribution?: {
    oneStar?: number;
    twoStar?: number;
    threeStar?: number;
    fourStar?: number;
    fiveStar?: number;
  };

  reviewHighlights: ReviewHighlight[];

  sources: {
    hardcover?: boolean;
    googleBooks?: boolean;
    openLibrary?: boolean;
    nyt?: boolean;
    libraryThing?: boolean;
  };

  lastFetchedAt: string;
}

export interface ReviewHighlight {
  id: string;
  // `"mock"` is used by `mockSocialProof` so fabricated snippets can't be
  // mis-attributed to a real provider (e.g. an Open Library integration
  // landing later must not pick these rows up as real data).
  source: "hardcover" | "google" | "openlibrary" | "nyt" | "librarything" | "mock";
  reviewerName?: string;
  rating?: number;
  text?: string;
  summary?: string;
  url?: string;
  containsSpoilers?: boolean;
  reviewType: "reader" | "critic" | "tag";
  publishedAt?: string;
}

export interface SocialProofInput {
  bookId: string;
  isbn?: string;
  title?: string;
  author?: string;
}

// ---------- Hardcover client ----------

const HARDCOVER_URL = "https://api.hardcover.app/v1/graphql";
const HARDCOVER_TIMEOUT_MS = 8_000;

// Hardcover schema (verified 2026-06-30 against hardcover-docs):
//   - `books` does NOT expose `isbn` or a `reviews` connection.
//   - ISBNs live on `editions` (`isbn_13` / `isbn_10`); nested under `book`.
//   - Average rating is `rating` (not `ratings_average`).
//   - Reviews live on `user_books.review` (one per user-book row, not a list per book).
// Queries below are shaped accordingly; a mismatch here causes Hardcover to return
// `errors[]` and the route silently falls back to the mock.
interface HardcoverUserBook {
  id: number | string;
  rating?: number;
  review?: string | null;
  review_has_spoilers?: boolean;
  created_at?: string;
  user?: { username?: string };
}

// The `book` fields we need from either query path. `editions[].book` and
// `books[]` return the same shape (we ask for the same fragment), so we
// share one extraction.
interface HardcoverBook {
  id: number;
  slug?: string;
  title?: string;
  rating?: number;
  ratings_count?: number;
  reviews_count?: number;
  user_books?: HardcoverUserBook[];
}

interface HardcoverResponse {
  data?: {
    editions?: Array<{ book?: HardcoverBook | null }>;
    books?: HardcoverBook[];
  };
  errors?: Array<{ message: string }>;
}

// `fetchHardcoverReviews` — single source of truth for the Hardcover
// fetch path. Mock-first: when no token is configured, returns a
// deterministic mock so dev / tests always see populated data.
export async function fetchHardcoverReviews(input: SocialProofInput): Promise<BookSocialProofDTO> {
  const token = process.env.HARDCOVER_TOKEN?.trim();
  if (!token) {
    return mockSocialProof(input);
  }

  try {
    // POST a GraphQL query to Hardcover. We search by ISBN first (more
    // precise than title/author) and fall back to title+author when ISBN
    // is missing or returns no hits. ISBN goes through `$variables` so it
    // never has to be interpolated into the query string.
    const { query, variables } = buildHardcoverQuery(input);
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    };
    const upstream = await fetch(HARDCOVER_URL, {
      method: "POST",
      headers,
      body: JSON.stringify({ query, variables }),
      // Hardcoded 8s so a hung Hardcover call can't tie up the route.
      signal: AbortSignal.timeout(HARDCOVER_TIMEOUT_MS),
    });
    if (!upstream.ok) {
      // Treat 4xx/5xx as "no data" and fall back to the mock so the UI
      // is never blank. The route layer logs the status code separately.
      return mockSocialProof(input);
    }
    const json = (await upstream.json()) as HardcoverResponse;
    // ISBN path: first edition (carries the isbn), then its parent book.
    // Title path: books query directly.
    const book = input.isbn
      ? (json.data?.editions?.[0]?.book ?? null)
      : (json.data?.books?.[0] ?? null);
    if (!book) {
      // No match in Hardcover (common for niche Polish books). Surface the
      // mock anyway so the UI has something to render — and clearly mark
      // the source as "not from Hardcover".
      return mockSocialProof(input);
    }
    return normalizeHardcover(input.bookId, book);
  } catch {
    // Network error, timeout, abort — fall back to mock.
    return mockSocialProof(input);
  }
}

// The set of `book` fields we need from either query path. Same shape from
// `editions[].book` and from `books[]`, so we share one extraction.
const BOOK_FRAGMENT = `
  id
  slug
  title
  rating
  ratings_count
  reviews_count
  user_books(where: {review: {_is_null: false}}, limit: 3, order_by: {created_at: desc}) {
    id
    rating
    review
    review_has_spoilers
    created_at
    user { username }
  }
`;

function buildHardcoverQuery(input: SocialProofInput): {
  query: string;
  variables: Record<string, unknown>;
} {
  // Minimal query — fetch the first matching book plus its top 3 reviews.
  // We deliberately keep this small so a hung upstream returns quickly.
  if (input.isbn) {
    // ISBNs live on `editions` (isbn_13 / isbn_10). We pick the first matching
    // edition and pull its parent book with the same fragment. The isbn is
    // passed through `$variables` so it cannot be smuggled into the query
    // string (no injection risk).
    return {
      query: `query SearchByISBN($isbn: String!) {
        editions(where: {isbn_13: {_eq: $isbn}}, limit: 1) {
          book {
            ${BOOK_FRAGMENT}
          }
        }
      }`,
      variables: { isbn: input.isbn },
    };
  }
  const title = escapeGql(input.title ?? "");
  // S6: a user-entered `%` or `_` would otherwise be interpreted as a
  // Postgres ILIKE wildcard — book titled "50%" would silently match
  // "50 shades of grey" too. We escape the metacharacters AND pass the
  // value through a GraphQL `$title` variable so the query string itself
  // contains no caller data (defence-in-depth against injection).
  return {
    query: `query SearchByTitle($title: String!) {
      books(where: {title: {_ilike: $title}}, limit: 1) {
        ${BOOK_FRAGMENT}
      }
    }`,
    variables: { title: `%${escapeIlike(title)}%` },
  };
}

/**
 * Escape Postgres ILIKE wildcard metacharacters (`%`, `_`, `\`) so a user
 * title containing any of them is matched literally rather than as a pattern.
 * Without this, title="50%" would match every book containing "50".
 *
 * Exported for unit testing — see social-proof.server.spec.ts.
 */
export function escapeIlike(s: string): string {
  return s.replace(/[\\%_]/g, "\\$&");
}

function escapeGql(s: string): string {
  // Strip ASCII control chars (incl. newlines) so a malicious or accidentally
  // multi-line title cannot break out of the GraphQL string literal. Hard cap
  // at 256B to defuse oversized-payload DoS. Range written with \u escapes
  // so the source file carries no literal C0 bytes (lint-friendly).
  return (
    s
      // eslint-disable-next-line no-control-regex -- intentional C0 strip
      .replace(/[\u0000-\u001f\u007f]/g, "")
      .replace(/[\\"]/g, "\\$&")
      .slice(0, 256)
  );
}

function normalizeHardcover(bookId: string, book: HardcoverBook): BookSocialProofDTO {
  const dist = emptyDistribution();
  // Hardcover doesn't return a distribution block; we leave the per-star
  // counts undefined and rely on the average + count in the UI.
  // Reviews live on `user_books.review` (one per user-book row), not as a
  // connection on `book`. Filter out rows without a review text.
  const reviewed = (book.user_books ?? []).filter((ub) => !!ub.review);
  const highlights: ReviewHighlight[] = reviewed.slice(0, 3).map((ub) => ({
    id: `hc-${ub.id}`,
    source: "hardcover" as const,
    reviewerName: ub.user?.username,
    rating: ub.rating,
    text: ub.review?.slice(0, 2_000) ?? undefined,
    containsSpoilers: ub.review_has_spoilers ?? false,
    reviewType: "reader" as const,
    publishedAt: ub.created_at,
  }));
  return {
    bookId,
    averageRating: book.rating,
    ratingsCount: book.ratings_count,
    reviewsCount: book.reviews_count ?? highlights.length,
    ratingDistribution: dist,
    reviewHighlights: highlights,
    sources: { hardcover: true },
    lastFetchedAt: new Date().toISOString(),
  };
}

function emptyDistribution(): BookSocialProofDTO["ratingDistribution"] {
  return {
    oneStar: undefined,
    twoStar: undefined,
    threeStar: undefined,
    fourStar: undefined,
    fiveStar: undefined,
  };
}

// ---------- §4.5 NYT critic reviews ----------
//
// NYT's `books/v3/reviews.json` returns a small JSON list of professional
// critic reviews keyed by ISBN. We treat it as an additive layer on top of
// the Hardcover reader-reviews row — the route merges by concatenating
// `reviewHighlights` and OR-ing the `sources` flags.
//
// Returns `null` when:
//   - NYT_API_KEY is unset (the operator hasn't opted in),
//   - the upstream 4xx/5xx's,
//   - the JSON doesn't parse,
//   - there are no `results`.
//
// We never throw — the route layer treats `null` as "skip this provider".
const NYT_REVIEWS_URL = "https://api.nytimes.com/svc/books/v3/reviews.json";
const NYT_TIMEOUT_MS = 6_000;

export async function fetchNytReviews(input: SocialProofInput): Promise<BookSocialProofDTO | null> {
  const key = process.env.NYT_API_KEY?.trim();
  if (!key) return null;
  if (!input.isbn) return null;

  const url = new URL(NYT_REVIEWS_URL);
  url.searchParams.set("isbn", input.isbn.replace(/-/g, "").slice(0, 13));
  url.searchParams.set("api-key", key);

  try {
    const upstream = await fetch(url.toString(), {
      signal: AbortSignal.timeout(NYT_TIMEOUT_MS),
    });
    if (!upstream.ok) return null;
    const json = (await upstream.json()) as {
      status?: string;
      results?: Array<{
        url?: string;
        publication_dt?: string;
        byline?: string;
        book_title?: string;
        summary?: string;
      }>;
    };
    if (json.status !== "OK" || !Array.isArray(json.results) || json.results.length === 0)
      return null;

    const highlights: ReviewHighlight[] = json.results.slice(0, 3).map((r, i) => ({
      id: `nyt-${input.bookId}-${i}`,
      source: "nyt" as const,
      reviewerName: r.byline,
      summary: r.summary?.slice(0, 2_000),
      url: r.url,
      reviewType: "critic" as const,
      publishedAt: r.publication_dt,
    }));

    return {
      bookId: input.bookId,
      reviewHighlights: highlights,
      sources: { nyt: true },
      lastFetchedAt: new Date().toISOString(),
    };
  } catch {
    return null;
  }
}

// ---------- §4.3 LibraryThing tag reviews ----------
//
// LibraryThing exposes a per-work review XML feed keyed by ISBN. We parse
// it with a tiny inline XML reader (the response is small + flat; no
// dependencies required) and surface up to 3 tag-style highlights.
//
// Like NYT, returns `null` on any failure / unset token.
const LIBRARYTHING_URL = "https://www.librarything.com/api/thingReview.php";
const LIBRARYTHING_TIMEOUT_MS = 6_000;

export async function fetchLibraryThingReviews(
  input: SocialProofInput,
): Promise<BookSocialProofDTO | null> {
  const token = process.env.LIBRARYTHING_TOKEN?.trim();
  if (!token) return null;
  if (!input.isbn) return null;

  const url = new URL(LIBRARYTHING_URL);
  url.searchParams.set("isbn", input.isbn);
  url.searchParams.set("token", token);

  try {
    const upstream = await fetch(url.toString(), {
      signal: AbortSignal.timeout(LIBRARYTHING_TIMEOUT_MS),
    });
    if (!upstream.ok) return null;
    const xml = await upstream.text();
    const ratings = parseLibraryThingXml(xml);
    if (ratings.length === 0) return null;

    const highlights: ReviewHighlight[] = ratings.slice(0, 3).map((r, i) => ({
      id: `lt-${input.bookId}-${i}`,
      source: "librarything" as const,
      reviewerName: r.reviewer,
      rating: r.rating,
      text: r.comment?.slice(0, 2_000),
      reviewType: "tag" as const,
      publishedAt: r.date,
    }));

    return {
      bookId: input.bookId,
      reviewHighlights: highlights,
      sources: { libraryThing: true },
      lastFetchedAt: new Date().toISOString(),
    };
  } catch {
    return null;
  }
}

interface LibraryThingReview {
  rating?: number;
  reviewer?: string;
  comment?: string;
  date?: string;
}

/** Minimal XML extract — only the fields we need, no DOM parser dependency. */
function parseLibraryThingXml(xml: string): LibraryThingReview[] {
  const out: LibraryThingReview[] = [];
  const re = /<review\b[^>]*>([\s\S]*?)<\/review>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(xml))) {
    const block = m[1];
    const rating = firstInt(block, "rating");
    const reviewer = firstText(block, "reviewer");
    const comment = firstText(block, "comment");
    const date = firstText(block, "date");
    out.push({ rating, reviewer, comment, date });
  }
  return out;
}

function firstText(block: string, tag: string): string | undefined {
  const re = new RegExp(`<${tag}>([\\s\\S]*?)<\\/${tag}>`, "i");
  const m = block.match(re);
  return m ? m[1].trim() : undefined;
}

function firstInt(block: string, tag: string): number | undefined {
  const text = firstText(block, tag);
  if (!text) return undefined;
  const n = parseInt(text, 10);
  return Number.isFinite(n) ? n : undefined;
}

// ---------- deterministic mock ----------
// `mockSocialProof` builds a fake-but-stable response from the input so
// the UI always has something to render when no real data is available.
// The hash drives the numbers; identical inputs always produce identical
// output, so tests can pin against it.
export function mockSocialProof(input: SocialProofInput): BookSocialProofDTO {
  const seed = `${input.isbn ?? ""}|${input.title ?? ""}|${input.author ?? ""}`;
  const hash = fnv1a(seed);
  // Spread the distribution so it doesn't always peak at 5 stars — gives
  // the rating-bar UI something interesting to render. `>>>` (unsigned) is
  // used instead of `>>` (signed) so a `hash` with the high bit set does not
  // yield a negative `x % N` — JS's `%` on a negative dividend is negative.
  const one = (hash % 13) + 2;
  const two = ((hash >>> 3) % 27) + 5;
  const three = ((hash >>> 5) % 41) + 9;
  const four = ((hash >>> 7) % 89) + 18;
  const five = ((hash >>> 11) % 157) + 35;
  const total = one + two + three + four + five;
  const sum = one * 1 + two * 2 + three * 3 + four * 4 + five * 5;
  const averageRating = Math.round((sum / total) * 10) / 10;

  // Two fake review snippets, deterministically derived from the same
  // hash. The source is marked as `"mock"` so the UI / future Open Library
  // integration can't confuse these fabricated snippets with real reader
  // reviews.
  const t1 = pickSnippet(hash, 0);
  const t2 = pickSnippet(hash, 1);

  return {
    bookId: input.bookId,
    averageRating,
    ratingsCount: total,
    reviewsCount: 2,
    ratingDistribution: {
      oneStar: one,
      twoStar: two,
      threeStar: three,
      fourStar: four,
      fiveStar: five,
    },
    reviewHighlights: [
      {
        id: `mock-1-${input.bookId}`,
        // `"mock"` so the UI / future Open Library integration can't confuse
        // these fabricated snippets with real reader reviews.
        source: "mock",
        summary: t1,
        rating: 4 + (hash % 2),
        reviewType: "tag",
      },
      {
        id: `mock-2-${input.bookId}`,
        // `"mock"` so the UI / future Open Library integration can't confuse
        // these fabricated snippets with real reader reviews.
        source: "mock",
        summary: t2,
        rating: 3 + (hash % 3),
        reviewType: "tag",
      },
    ],
    sources: {},
    lastFetchedAt: new Date().toISOString(),
  };
}

// FNV-1a 32-bit. Small, no deps, stable across runtimes — and faster than
// pulling in `crypto` for what's effectively a stable hash.
function fnv1a(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

const SNIPPETS = [
  "Wciągająca od pierwszej strony.",
  "Świetne tempo, mocne zakończenie.",
  "Bohaterowie z krwi i kości.",
  "Język prosty, ale nie banalny.",
  "Jedna z lepszych rzeczy, jakie ostatnio czytałam.",
  "Drobne dłużyzny w środku, ale finał rekompensuje.",
  "Klimat jak z dobrej kawiarni w deszczowy dzień.",
  "Będę wracać do tej książki.",
];

function pickSnippet(hash: number, offset: number): string {
  return SNIPPETS[(hash + offset * 31) % SNIPPETS.length];
}
