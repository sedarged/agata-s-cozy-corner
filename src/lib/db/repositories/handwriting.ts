// Agata — multi-page handwriting repository. CRUD over `handwriting_pages`.
// Each page is a row, ordered by (noteId, pageIndex). FK ON DELETE CASCADE on
// noteId means removing a note wipes its pages — no orphans.
import "@tanstack/react-start/server-only";

import { and, asc, eq, max } from "drizzle-orm";

import { getDb } from "../client";
import { handwritingPages, type HandwritingPage, type HandwritingPageInsert } from "../schema";

// Re-export so consumers (handlers, tests) can import the row shape without
// also importing the schema directly.
export type { HandwritingPage, HandwritingPageInsert };

const nowIso = () => new Date().toISOString();

/** All pages for a note, ordered 0..N. Empty array if the note has none. */
export async function listPages(noteId: string): Promise<HandwritingPage[]> {
  return getDb()
    .select()
    .from(handwritingPages)
    .where(eq(handwritingPages.noteId, noteId))
    .orderBy(asc(handwritingPages.pageIndex))
    .all() as HandwritingPage[];
}

/** Single page by id. Returns undefined if not found. */
export async function getPage(id: string): Promise<HandwritingPage | undefined> {
  return getDb().select().from(handwritingPages).where(eq(handwritingPages.id, id)).get() as
    | HandwritingPage
    | undefined;
}

/** Total page count for a note. */
export async function countPages(noteId: string): Promise<number> {
  const rows = getDb()
    .select({ pageIndex: handwritingPages.pageIndex })
    .from(handwritingPages)
    .where(eq(handwritingPages.noteId, noteId))
    .all() as { pageIndex: number }[];
  return rows.length;
}

/** Highest existing pageIndex for a note, or -1 if the note has no pages. */
export async function maxPageIndex(noteId: string): Promise<number> {
  const r = getDb()
    .select({ m: max(handwritingPages.pageIndex) })
    .from(handwritingPages)
    .where(eq(handwritingPages.noteId, noteId))
    .get() as { m: number | null };
  return r.m ?? -1;
}

export interface SavePageInput {
  id: string;
  noteId: string;
  pageIndex: number;
  dataUrl: string;
  background?: string;
}

/**
 * Upsert a page by id. Used by the PUT endpoint to persist either a brand-new
 * page or the current active page after edits. Preserves createdAt on update.
 */
export async function savePage(input: SavePageInput): Promise<HandwritingPage> {
  const now = nowIso();
  const existing = await getPage(input.id);
  const row: HandwritingPageInsert = {
    id: input.id,
    noteId: input.noteId,
    pageIndex: input.pageIndex,
    dataUrl: input.dataUrl,
    background: input.background ?? "plain",
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  };
  getDb()
    .insert(handwritingPages)
    .values(row)
    .onConflictDoUpdate({
      target: handwritingPages.id,
      set: {
        pageIndex: row.pageIndex,
        dataUrl: row.dataUrl,
        background: row.background,
        updatedAt: row.updatedAt,
      },
    })
    .run();
  return (await getPage(input.id))!;
}

/**
 * Append a fresh empty page after the current highest index. Returns the
 * newly created row. Caller is expected to write the rendered canvas to it.
 */
export async function appendPage(noteId: string, background = "plain"): Promise<HandwritingPage> {
  const id = `hwp-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  const nextIndex = (await maxPageIndex(noteId)) + 1;
  return savePage({ id, noteId, pageIndex: nextIndex, dataUrl: "", background });
}

export async function deletePage(id: string): Promise<boolean> {
  const res = getDb().delete(handwritingPages).where(eq(handwritingPages.id, id)).run();
  return res.changes > 0;
}

/**
 * Re-pack page indexes for a note into a contiguous 0..N-1 range. Called after
 * `deletePage` so the remaining pages stay addressable in the UI without
 * leaving holes. Safe no-op if there's nothing to renumber.
 */
export async function renumberPages(noteId: string): Promise<void> {
  const pages = await listPages(noteId);
  const now = nowIso();
  // Walk in order; assign sequential indexes.
  for (let i = 0; i < pages.length; i++) {
    const p = pages[i];
    if (p.pageIndex !== i) {
      getDb()
        .update(handwritingPages)
        .set({ pageIndex: i, updatedAt: now })
        .where(and(eq(handwritingPages.id, p.id), eq(handwritingPages.noteId, noteId)))
        .run();
    }
  }
}
