// Agata — notes repository. CRUD over the `notes` table.
import { and, desc, eq } from "drizzle-orm";
import { getDb } from "../client";
import { notes, notesDeleted } from "../schema";
import type { NoteRow, NoteInsert } from "../types";

const nowIso = () => new Date().toISOString();
const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

export async function listNotes(): Promise<NoteRow[]> {
  return getDb().select().from(notes).orderBy(desc(notes.createdAt)).all() as NoteRow[];
}

export async function listNotesForBook(bookId: string): Promise<NoteRow[]> {
  return getDb()
    .select()
    .from(notes)
    .where(eq(notes.bookId, bookId))
    .orderBy(desc(notes.createdAt))
    .all() as NoteRow[];
}

export async function getNote(id: string): Promise<NoteRow | undefined> {
  return getDb().select().from(notes).where(eq(notes.id, id)).get() as NoteRow | undefined;
}

export interface NoteInput {
  id?: string;
  bookId: string;
  type: NoteRow["type"];
  title?: string | null;
  content?: string;
  quoteText?: string | null;
  comment?: string | null;
  pageNumber?: number | null;
  chapterNumber?: number | null;
  chapterTitle?: string | null;
  photoUrl?: string | null;
  inputMode?: NoteRow["inputMode"];
  drawingDataUrl?: string | null;
  drawingBackground?: NoteRow["drawingBackground"];
  isFavourite?: boolean;
  tags?: string[];
}

export async function createNote(input: NoteInput & { id: string }): Promise<NoteRow> {
  const now = nowIso();
  const row: NoteInsert = {
    id: input.id,
    bookId: input.bookId,
    type: input.type,
    title: input.title ?? null,
    content: input.content ?? "",
    quoteText: input.quoteText ?? null,
    comment: input.comment ?? null,
    pageNumber: input.pageNumber ?? null,
    chapterNumber: input.chapterNumber ?? null,
    chapterTitle: input.chapterTitle ?? null,
    photoUrl: input.photoUrl ?? null,
    inputMode: input.inputMode ?? null,
    drawingDataUrl: input.drawingDataUrl ?? null,
    drawingBackground: input.drawingBackground ?? null,
    isFavourite: input.isFavourite ?? false,
    tags: input.tags ?? [],
    createdAt: today(),
    updatedAt: now,
  };
  getDb().insert(notes).values(row).run();
  return (await getNote(input.id))!;
}

/**
 * Upsert a note by id. Preserves the original `createdAt` if the row already
 * exists. Used by the import "merge" path so re-running with the same payload
 * is idempotent.
 */
export async function upsertNote(
  input: NoteInput & { id: string; createdAt?: string },
): Promise<NoteRow> {
  const existing = await getNote(input.id);
  const createdAt = existing?.createdAt ?? input.createdAt ?? today();
  const now = nowIso();
  const row: NoteInsert = {
    id: input.id,
    bookId: input.bookId,
    type: input.type,
    title: input.title ?? null,
    content: input.content ?? "",
    quoteText: input.quoteText ?? null,
    comment: input.comment ?? null,
    pageNumber: input.pageNumber ?? null,
    chapterNumber: input.chapterNumber ?? null,
    chapterTitle: input.chapterTitle ?? null,
    photoUrl: input.photoUrl ?? null,
    inputMode: input.inputMode ?? null,
    drawingDataUrl: input.drawingDataUrl ?? null,
    drawingBackground: input.drawingBackground ?? null,
    isFavourite: input.isFavourite ?? false,
    tags: input.tags ?? [],
    createdAt,
    updatedAt: now,
  };
  getDb()
    .insert(notes)
    .values(row)
    .onConflictDoUpdate({
      target: notes.id,
      set: {
        bookId: row.bookId,
        type: row.type,
        title: row.title,
        content: row.content,
        quoteText: row.quoteText,
        comment: row.comment,
        pageNumber: row.pageNumber,
        chapterNumber: row.chapterNumber,
        chapterTitle: row.chapterTitle,
        photoUrl: row.photoUrl,
        inputMode: row.inputMode,
        drawingDataUrl: row.drawingDataUrl,
        drawingBackground: row.drawingBackground,
        isFavourite: row.isFavourite,
        tags: row.tags,
        updatedAt: row.updatedAt,
      },
    })
    .run();
  return (await getNote(input.id))!;
}

export async function patchNote(
  id: string,
  patch: Partial<NoteInput>,
): Promise<NoteRow | undefined> {
  const existing = await getNote(id);
  if (!existing) return undefined;
  const next: NoteRow = {
    ...existing,
    ...patch,
    id: existing.id,
    bookId: existing.bookId,
    createdAt: existing.createdAt,
    updatedAt: nowIso(),
  };
  getDb().update(notes).set(next).where(eq(notes.id, id)).run();
  return getNote(id);
}

export async function deleteNote(id: string): Promise<boolean> {
  // Also tombstone the id so backup/import semantics match the old store.
  getDb().insert(notesDeleted).values({ id }).onConflictDoNothing().run();
  const res = getDb().delete(notes).where(eq(notes.id, id)).run();
  return res.changes > 0;
}

/** Insert a tombstone without deleting a live note (used by import mirror). */
export async function markNoteDeleted(id: string): Promise<void> {
  getDb().insert(notesDeleted).values({ id }).onConflictDoNothing().run();
}

/** Bulk-drop every note + every tombstone. Used by the import "replace" wipe. */
export async function deleteAllNotes(): Promise<void> {
  // Children before parents: tombstones are leaf rows, notes depend on books.
  // FK ON DELETE CASCADE on books would also drop notes, so we clear notes
  // explicitly when the caller wants to keep the books table.
  getDb().delete(notesDeleted).run();
  getDb().delete(notes).run();
}

export async function listDeletedNoteIds(): Promise<string[]> {
  return (getDb().select({ id: notesDeleted.id }).from(notesDeleted).all() as { id: string }[]).map(
    (r) => r.id,
  );
}

export async function undeleteNote(
  id: string,
  original: NoteInput & { id: string; createdAt: string },
): Promise<NoteRow | undefined> {
  // Remove tombstone + re-insert preserving the original createdAt.
  getDb().delete(notesDeleted).where(eq(notesDeleted.id, id)).run();
  getDb()
    .insert(notes)
    .values({
      ...original,
      content: original.content ?? "",
      tags: original.tags ?? [],
      isFavourite: original.isFavourite ?? false,
      updatedAt: nowIso(),
    })
    .run();
  return getNote(id);
}
