// Agata — review_cache repo (§9 polish plan).
//
// CRUD over the `review_cache` table that stores per-(book, source)
// social-proof provider responses. The route layer
// (`/api/books/:id/social-proof`) uses `getReviewCache` + `isCacheStale`
// (from `./review-cache`) to decide whether to short-circuit with a
// cached row or call upstream.
//
// Payload is a JSON-serialised `BookSocialProofDTO`. The repo only
// enforces the string-id cap; structure validation happens at the
// DTO boundary so a future provider-shape change doesn't require a
// migration.
import { and, eq } from "drizzle-orm";
import { getDb } from "../client";
import { reviewCache } from "../schema";
import type { ReviewCacheRow, ReviewCacheInsert } from "../types";

const nowIso = () => new Date().toISOString();

export interface ReviewCacheKey {
  bookId: string;
  source: string;
}

export interface UpsertReviewCacheInput extends ReviewCacheKey {
  /** Anything JSON-serialisable — typically a `BookSocialProofDTO`. */
  payload: unknown;
}

/**
 * Upsert a (bookId, source) cache row. Replaces both the payload AND
 * the `fetched_at` timestamp so the next `isCacheStale` check
 * correctly returns false until the TTL elapses.
 */
export async function upsertReviewCache(input: UpsertReviewCacheInput): Promise<ReviewCacheRow> {
  const fetchedAt = nowIso();
  getDb()
    .insert(reviewCache)
    .values({
      bookId: input.bookId,
      source: input.source,
      payload: JSON.stringify(input.payload),
      fetchedAt,
    })
    .onConflictDoUpdate({
      target: [reviewCache.bookId, reviewCache.source],
      set: { payload: JSON.stringify(input.payload), fetchedAt },
    })
    .run();
  return (await getReviewCache({ bookId: input.bookId, source: input.source }))!;
}

/**
 * Fetch a single cache row by composite key. Returns `undefined` when
 * the row is missing so the caller can branch to "fetch fresh".
 */
export async function getReviewCache(key: ReviewCacheKey): Promise<ReviewCacheRow | undefined> {
  return getDb()
    .select()
    .from(reviewCache)
    .where(and(eq(reviewCache.bookId, key.bookId), eq(reviewCache.source, key.source)))
    .get() as ReviewCacheRow | undefined;
}

// Re-export the row type so consumers don't have to dive into `db/types.ts`.
export type { ReviewCacheRow, ReviewCacheInsert };
