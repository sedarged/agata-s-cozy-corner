// Agata — books repository. CRUD over the `books` table.
// All functions are async (server-side); client calls go through server fns.
import { and, desc, eq, like, or, sql } from "drizzle-orm";
import { getDb } from "../client";
import { books } from "../schema";
import type { BookRow, BookInsert } from "../types";

const nowIso = () => new Date().toISOString();

export async function listBooks(): Promise<BookRow[]> {
  return getDb().select().from(books).orderBy(desc(books.addedAt)).all() as BookRow[];
}

export async function getBook(id: string): Promise<BookRow | undefined> {
  return getDb().select().from(books).where(eq(books.id, id)).get() as BookRow | undefined;
}

export interface BookInput {
  id?: string;
  title: string;
  author: string;
  isbn?: string;
  coverUrl?: string | null;
  coverGradient?: string;
  coverAccent?: string;
  description?: string;
  pageCount?: number;
  currentPage?: number;
  publishedDate?: string;
  genre?: string;
  status?: BookRow["status"];
  rating?: number | null;
  isFavourite?: boolean;
  tags?: string[];
  publisher?: string | null;
  language?: string | null;
  seriesName?: string | null;
  seriesPart?: string | null;
  source?: BookRow["source"];
  opinion?: string | null;
  startedAt?: string | null;
  finishedAt?: string | null;
  // Wikidata enrichment (nullable). Populated by the fire-and-forget
  // `enrichBookAsync` helper — never set by callers directly.
  wikidataId?: string | null;
  wikidataDescription?: string | null;
  enrichedAt?: string | null;
}

/**
 * Apply a Wikidata enrichment hit to a book row. Stamps `enriched_at` to
 * "now" and writes the qid + Wikidata blurb. No-op (returns undefined)
 * when the book no longer exists — callers treat the same as a successful
 * enrichment whose row vanished mid-flight (race with delete).
 *
 * Lives in the repo so it composes with the existing `patchBook` row-update
 * path; this avoids bypassing the books repo's `updatedAt` stamping.
 */
export async function applyWikidataEnrichment(
  id: string,
  hit: { wikidataId: string; wikidataDescription?: string | null },
): Promise<BookRow | undefined> {
  return patchBook(id, {
    wikidataId: hit.wikidataId,
    wikidataDescription: hit.wikidataDescription ?? null,
    enrichedAt: nowIso(),
  });
}

export async function upsertBook(input: BookInput & { id: string }): Promise<BookRow> {
  const now = nowIso();
  const row: BookInsert = {
    id: input.id,
    title: input.title,
    author: input.author ?? "",
    isbn: input.isbn ?? "",
    coverUrl: input.coverUrl ?? null,
    coverGradient: input.coverGradient ?? "from-amber-100 to-rose-200",
    coverAccent: input.coverAccent ?? "#a16207",
    description: input.description ?? "",
    pageCount: input.pageCount ?? 0,
    currentPage: input.currentPage ?? 0,
    publishedDate: input.publishedDate ?? "",
    genre: input.genre ?? "",
    status: input.status ?? "queue",
    rating: input.rating ?? null,
    isFavourite: input.isFavourite ?? false,
    tags: input.tags ?? [],
    publisher: input.publisher ?? null,
    language: input.language ?? null,
    seriesName: input.seriesName ?? null,
    seriesPart: input.seriesPart ?? null,
    source: input.source ?? "manual",
    opinion: input.opinion ?? null,
    startedAt: input.startedAt ?? null,
    finishedAt: input.finishedAt ?? null,
    wikidataId: input.wikidataId ?? null,
    wikidataDescription: input.wikidataDescription ?? null,
    enrichedAt: input.enrichedAt ?? null,
    addedAt: now,
    updatedAt: now,
  };
  // SQLite "INSERT ... ON CONFLICT DO UPDATE" via Drizzle's onConflictDoUpdate.
  getDb()
    .insert(books)
    .values(row)
    .onConflictDoUpdate({
      target: books.id,
      set: {
        title: row.title,
        author: row.author,
        isbn: row.isbn,
        coverUrl: row.coverUrl,
        coverGradient: row.coverGradient,
        coverAccent: row.coverAccent,
        description: row.description,
        pageCount: row.pageCount,
        currentPage: row.currentPage,
        publishedDate: row.publishedDate,
        genre: row.genre,
        status: row.status,
        rating: row.rating,
        isFavourite: row.isFavourite,
        tags: row.tags,
        publisher: row.publisher,
        language: row.language,
        seriesName: row.seriesName,
        seriesPart: row.seriesPart,
        source: row.source,
        opinion: row.opinion,
        startedAt: row.startedAt,
        finishedAt: row.finishedAt,
        updatedAt: row.updatedAt,
        // NOTE: wikidataId/wikidataDescription/enrichedAt are intentionally
        // NOT in the ON CONFLICT update set — the enrichment helper writes
        // them via patchBook so a re-import via this upsert path cannot
        // silently wipe freshly enriched data.
      },
    })
    .run();
  return (await getBook(input.id))!;
}

export async function patchBook(
  id: string,
  patch: Partial<BookInput>,
): Promise<BookRow | undefined> {
  const existing = await getBook(id);
  if (!existing) return undefined;
  const next: BookRow = {
    ...existing,
    ...patch,
    id: existing.id,
    updatedAt: nowIso(),
  };
  getDb().update(books).set(next).where(eq(books.id, id)).run();
  return getBook(id);
}

export async function deleteBook(id: string): Promise<boolean> {
  const res = getDb().delete(books).where(eq(books.id, id)).run();
  return res.changes > 0;
}

/**
 * Bulk-drop every row in the books table. Used by the import "replace" wipe.
 *
 * `notes.book_id` and `reading_sessions.book_id` both declare
 * `ON DELETE CASCADE` against `books.id`, so a single `DELETE FROM books`
 * would also drop the child rows via cascade. The caller wipes children
 * explicitly so it can also clear `notes_deleted` (tombstones) in the same
 * transaction — cascade alone would leave tombstone rows behind. Assets have
 * no FK to `books` and can be wiped independently.
 */
export async function deleteAllBooks(): Promise<number> {
  const res = getDb().delete(books).run();
  return res.changes;
}

/** Bump a numeric `currentPage` only if the new value is greater (monotonic). */
export async function bumpCurrentPage(id: string, next: number): Promise<BookRow | undefined> {
  const existing = await getBook(id);
  if (!existing) return undefined;
  const safe = Math.max(0, Math.round(next));
  if (safe <= existing.currentPage) return existing;
  return patchBook(id, { currentPage: safe });
}

/** Simple text search across title/author (Polish, no diacritics for the OR clause). */
export async function searchBooks(q: string): Promise<BookRow[]> {
  const term = `%${q.replace(/[%_]/g, (m) => `\\${m}`)}%`;
  return getDb()
    .select()
    .from(books)
    .where(or(like(books.title, term), like(books.author, term)))
    .orderBy(desc(books.addedAt))
    .all() as BookRow[];
}

/**
 * Pin a manual cover for a book. Stamps `manual_cover_set_at` so the UI
 * can render "okładka dodana ręcznie <data>". Idempotent — calling twice
 * with the same url refreshes the timestamp without changing anything else.
 *
 * Lives in the repo so callers don't have to thread `manual_cover_url`
 * through the schema-aware `patchBook` typing layer (the patch payload
 * shape intentionally forbids columns the wire should not write to).
 */
export async function setManualCover(id: string, dataUrl: string): Promise<BookRow | undefined> {
  if (!dataUrl || !dataUrl.startsWith("data:image/")) {
    throw new Error("setManualCover: dataUrl must be a data:image/ URL");
  }
  if (dataUrl.length > 2_000_000) {
    throw new Error("setManualCover: dataUrl exceeds 2 MB");
  }
  return patchBook(id, {
    manualCoverUrl: dataUrl,
    manualCoverSetAt: nowIso(),
  } as Partial<BookInput>);
}

/**
 * Clear the manual cover override. After this call, `cover_url` (the
 * API-derived one) takes over again. Safe to call when no manual cover is
 * set — it's a no-op.
 */
export async function clearManualCover(id: string): Promise<BookRow | undefined> {
  return patchBook(id, {
    manualCoverUrl: null,
    manualCoverSetAt: null,
  } as Partial<BookInput>);
}
