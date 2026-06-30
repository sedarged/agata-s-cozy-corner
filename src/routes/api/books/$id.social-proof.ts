// /api/books/:id/social-proof — returns reader ratings + highlights for a
// book from Hardcover (preferred) or the deterministic mock when no token
// is configured. Server-only because the Hardcover bearer token must not
// leak to the browser.
//
// Behaviour contract:
//   - 200 + BookSocialProofDTO when the book exists (even if Hardcover
//     returns nothing — the mock keeps the UI populated).
//   - 404 + { error: "not-found" } when the book is missing.
//   - 400 + { error: "invalid-id" } when the id fails the schema cap.
//
// §9 cache: the Hardcover row is replayed when `fetched_at` is within
// `BOOK_PROVIDER_CACHE_TTL_DAYS` (default 7). NYT + LibraryThing
// highlights are merged on EVERY request — those providers are cheap
// (single ISBN lookup, 6s timeout each) and the cache key is keyed on
// "hardcover" so NYT/LT provenance is NOT cached. Stale rows are
// refreshed upstream and upserted.
import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { apiJson } from "@/lib/api/error";
import * as booksRepo from "@/lib/db/repositories/books";
import * as reviewCacheRepo from "@/lib/db/repositories/review-cache-repo";
import { isCacheStale, reviewCacheTtlDaysFromEnv } from "@/lib/db/repositories/review-cache";
import {
  fetchHardcoverReviews,
  fetchLibraryThingReviews,
  fetchNytReviews,
  mockSocialProof,
  type BookSocialProofDTO,
} from "@/lib/social-proof.server";

const IdParam = z.string().min(1).max(128);

export interface SocialProofEnv {
  /** Node-style env object — accepts a stub for tests. */
  env?: Record<string, string | undefined>;
  /** Override the upstream fetcher (mockable for tests). */
  fetchFn?: typeof fetchHardcoverReviews;
  /** Override the NYT provider — defaults to `fetchNytReviews`. */
  nytFn?: typeof fetchNytReviews;
  /** Override the LibraryThing provider — defaults to `fetchLibraryThingReviews`. */
  libraryThingFn?: typeof fetchLibraryThingReviews;
}

export async function handleSocialProof(id: string, opts: SocialProofEnv = {}): Promise<Response> {
  const parsed = IdParam.safeParse(id);
  if (!parsed.success) {
    return apiJson({ error: "invalid-id" }, { status: 400 });
  }
  const bookId = parsed.data;
  const book = await booksRepo.getBook(bookId);
  if (!book) {
    return apiJson({ error: "not-found" }, { status: 404 });
  }

  const ttlDays = reviewCacheTtlDaysFromEnv(opts.env ?? process.env);
  const fetchFn = opts.fetchFn ?? fetchHardcoverReviews;
  const nytFn = opts.nytFn ?? fetchNytReviews;
  const ltFn = opts.libraryThingFn ?? fetchLibraryThingReviews;
  const input = {
    bookId: book.id,
    isbn: book.isbn || undefined,
    title: book.title,
    author: book.author || undefined,
  };

  // Hardcover row: cache-aside around `fetchHardcoverReviews`. On hit we
  // skip upstream entirely and use the cached payload. On miss/stale we
  // re-fetch and upsert the *Hardcover-only* row (NYT/LT slices are NOT
  // cached — see merge step below).
  const cached = await reviewCacheRepo.getReviewCache({ bookId, source: "hardcover" });
  let proof: BookSocialProofDTO;
  if (cached && !isCacheStale(cached.fetchedAt, ttlDays)) {
    proof = JSON.parse(cached.payload) as BookSocialProofDTO;
  } else {
    try {
      proof = await fetchFn(input);
    } catch {
      // Network error, timeout, abort — fall back to the deterministic
      // mock so the UI is never blank.
      proof = mockSocialProof(input);
    }
    try {
      await reviewCacheRepo.upsertReviewCache({
        bookId,
        source: "hardcover",
        payload: proof,
      });
    } catch {
      // Cache is an optimisation — never fail the route on a write error.
    }
  }

  // §4.5 / §4.3: NYT + LibraryThing always run on every request so the
  // merge cannot be silently disabled by a warm Hardcover cache. Each
  // provider is null-safe on unset env / 4xx / 5xx; we wrap the parallel
  // promise set so a single throwable error in any provider cannot blank
  // the UI. `Promise.allSettled` over `Promise.all` so a single rejection
  // doesn't short-circuit the others.
  const [nytResult, ltResult] = await Promise.allSettled([nytFn(input), ltFn(input)]);
  const nyt = nytResult.status === "fulfilled" ? nytResult.value : null;
  const lt = ltResult.status === "fulfilled" ? ltResult.value : null;

  const merged: BookSocialProofDTO = {
    ...proof,
    reviewHighlights: [
      ...(proof.reviewHighlights ?? []),
      ...(nyt?.reviewHighlights ?? []),
      ...(lt?.reviewHighlights ?? []),
    ],
    sources: {
      ...(proof.sources ?? {}),
      ...(nyt?.sources ?? {}),
      ...(lt?.sources ?? {}),
    },
  };

  return apiJson(merged);
}

export const Route = createFileRoute("/api/books/$id/social-proof")({
  server: {
    handlers: {
      GET: async ({ params }) => handleSocialProof(params.id),
    },
  },
});
