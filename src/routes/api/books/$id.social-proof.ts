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
// §9 cache: per-(bookId, source) rows are replayed when their
// `fetched_at` is within `BOOK_PROVIDER_CACHE_TTL_DAYS` (default 7).
// Stale rows are refreshed upstream and upserted. The cache layer is
// transparent to the client — the wire shape is identical.
import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { apiJson } from "@/lib/api/error";
import * as booksRepo from "@/lib/db/repositories/books";
import * as reviewCacheRepo from "@/lib/db/repositories/review-cache-repo";
import { isCacheStale, reviewCacheTtlDaysFromEnv } from "@/lib/db/repositories/review-cache";
import { fetchHardcoverReviews, type BookSocialProofDTO } from "@/lib/social-proof.server";

const IdParam = z.string().min(1).max(128);

export interface SocialProofEnv {
  /** Node-style env object — accepts a stub for tests. */
  env?: Record<string, string | undefined>;
  /** Override the upstream fetcher (mockable for tests). */
  fetchFn?: typeof fetchHardcoverReviews;
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
  const cached = await reviewCacheRepo.getReviewCache({ bookId, source: "hardcover" });
  if (cached && !isCacheStale(cached.fetchedAt, ttlDays)) {
    return apiJson(JSON.parse(cached.payload) as BookSocialProofDTO);
  }

  const fetchFn = opts.fetchFn ?? fetchHardcoverReviews;
  const proof = await fetchFn({
    bookId: book.id,
    isbn: book.isbn || undefined,
    title: book.title,
    author: book.author || undefined,
  });
  try {
    await reviewCacheRepo.upsertReviewCache({ bookId, source: "hardcover", payload: proof });
  } catch {
    // Cache is an optimisation — never fail the route on a write error.
  }
  return apiJson(proof);
}

export const Route = createFileRoute("/api/books/$id/social-proof")({
  server: {
    handlers: {
      GET: async ({ params }) => handleSocialProof(params.id),
    },
  },
});
