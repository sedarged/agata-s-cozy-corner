// Agata — Zod schemas for the backup-import wire format.
// Mirrors the JSON shape produced by `buildBackup()` in src/lib/backup.ts so a
// file exported by one device can be re-imported on the server.
import { z } from "zod";
import { BookInputSchema, NoteInputSchema, SessionInputSchema, GoalsInputSchema } from "./schemas";

// LocalStorage books shape: { localBooks: Book[], overrides: Record<id, Book>, deletedIds: string[] }
const BooksShape = z.object({
  localBooks: z.array(z.unknown()).optional(),
  overrides: z.record(z.string(), z.unknown()).optional(),
  deletedIds: z.array(z.string()).optional(),
});

// Map: bookId -> BookUserState (status / currentPage / rating / favourite / opinion / startedAt / finishedAt)
const BookStateShape = z.record(z.string(), z.unknown());

const GoalsShape = z.object({
  yearlyBooks: z.number().int().nonnegative().optional(),
  weeklyMinutes: z.number().int().nonnegative().optional(),
  updatedAt: z.string().optional(),
});

export const BackupPayloadSchema = z.object({
  app: z.literal("agata"),
  schemaVersion: z.number().int().nonnegative(),
  exportedAt: z.string().optional(),
  data: z
    .object({
      books: BooksShape.optional(),
      bookState: BookStateShape.optional(),
      readingSessions: z.array(z.unknown()).optional(),
      notes: z.array(z.unknown()).optional(),
      notesDeleted: z.array(z.string()).optional(),
      goals: GoalsShape.optional(),
      handwritingPrefs: z.unknown().optional(),
      noteDrafts: z.record(z.string(), z.unknown()).optional(),
      extraKeys: z.record(z.string(), z.unknown()).optional(),
    })
    .passthrough(),
});

export type BackupPayload = z.infer<typeof BackupPayloadSchema>;

// ---- Per-record narrowed shapes (used by the applier) -----------------------

// Book record (after merging local + override + bookState).
const BookRowSchema = BookInputSchema.extend({
  // `cover_url` is the localStorage camelCase form; the server schema uses
  // `coverUrl`. Accept both at the wire boundary.
  cover_url: z.string().nullable().optional(),
});

export const ImportModeSchema = z.enum(["merge", "replace", "preview"]);

// ---------------------------------------------------------------------------
// Preview counts — returned by /api/import before any write.
// Project rule: "Import danych ma pokazać liczby do potwierdzenia".
// ---------------------------------------------------------------------------
export interface ImportPreview {
  books: number;
  notes: number;
  sessions: number;
  goals: number;
  drafts: number;
  handwritingPrefs: boolean;
  ok: boolean;
  error?: string;
}

/** Count top-level items in a backup payload. Defensive — missing fields → 0. */
export function previewBackup(payload: BackupPayload): ImportPreview {
  const d = payload.data ?? {};
  const booksObj = (d.books ?? {}) as {
    localBooks?: unknown[];
    overrides?: Record<string, unknown>;
  };
  // Distinct book ids (localBooks + overrides can share ids; we dedupe).
  const bookIds = new Set<string>();
  if (Array.isArray(booksObj.localBooks)) {
    for (const b of booksObj.localBooks) {
      if (b && typeof b === "object" && typeof (b as { id?: unknown }).id === "string") {
        bookIds.add((b as { id: string }).id);
      }
    }
  }
  if (booksObj.overrides && typeof booksObj.overrides === "object") {
    for (const id of Object.keys(booksObj.overrides)) bookIds.add(id);
  }
  // Notes + sessions also dedupe by id (defensive — payload may repeat ids).
  const noteIds = new Set<string>();
  if (Array.isArray(d.notes)) {
    for (const n of d.notes) {
      if (n && typeof n === "object" && typeof (n as { id?: unknown }).id === "string") {
        noteIds.add((n as { id: string }).id);
      }
    }
  }
  const sessionIds = new Set<string>();
  if (Array.isArray(d.readingSessions)) {
    for (const s of d.readingSessions) {
      if (s && typeof s === "object" && typeof (s as { id?: unknown }).id === "string") {
        sessionIds.add((s as { id: string }).id);
      }
    }
  }
  const goalCount =
    d.goals && typeof d.goals === "object" && Object.keys(d.goals as object).length > 0 ? 1 : 0;
  const draftCount =
    d.noteDrafts && typeof d.noteDrafts === "object" ? Object.keys(d.noteDrafts).length : 0;
  const hp = !!(d.handwritingPrefs && typeof d.handwritingPrefs === "object");
  return {
    books: bookIds.size,
    notes: noteIds.size,
    sessions: sessionIds.size,
    goals: goalCount,
    drafts: draftCount,
    handwritingPrefs: hp,
    ok: true,
  };
}

// ---- Normalised record arrays — what the applier hands to the repos --------

export interface NormalisedBooks {
  /** Books to upsert. merged from localBooks + overrides + bookState. */
  upserts: z.infer<typeof BookRowSchema>[];
  /** Deleted ids — soft-deleted (inserted into `books_deleted` table analog or just skipped). */
  deletedIds: string[];
}

export interface NormalisedPayload {
  books: NormalisedBooks;
  notes: z.infer<typeof NoteInputSchema>[];
  sessions: z.infer<typeof SessionInputSchema>[];
  goals?: z.infer<typeof GoalsInputSchema>;
  deletedNoteIds: string[];
}

/** Map the legacy `cover_url` snake_case field onto the camelCase schema. */
function normalizeCoverUrlAlias(row: Record<string, unknown>): Record<string, unknown> {
  if (typeof row.cover_url === "string" && row.coverUrl === undefined) {
    row.coverUrl = row.cover_url;
  }
  delete row.cover_url;
  return row;
}

/** Normalise the loose backup shape into strictly-typed records. */
export function normaliseBackup(payload: BackupPayload): NormalisedPayload {
  const d = payload.data ?? {};
  const booksShape = (d.books ?? {}) as {
    localBooks?: unknown[];
    overrides?: Record<string, unknown>;
    deletedIds?: unknown[];
  };
  const bookState = (d.bookState ?? {}) as Record<string, Record<string, unknown>>;

  const bookById = new Map<string, Record<string, unknown>>();
  // Start with the localBook list.
  if (Array.isArray(booksShape.localBooks)) {
    for (const b of booksShape.localBooks) {
      if (!b || typeof b !== "object") continue;
      const obj = b as Record<string, unknown>;
      const id = typeof obj.id === "string" ? obj.id : null;
      if (!id) continue;
      bookById.set(id, normalizeCoverUrlAlias({ ...obj }));
    }
  }
  // Apply overrides on top.
  if (booksShape.overrides && typeof booksShape.overrides === "object") {
    for (const [id, ov] of Object.entries(booksShape.overrides)) {
      if (!ov || typeof ov !== "object") continue;
      const prev = bookById.get(id) ?? { id };
      bookById.set(id, normalizeCoverUrlAlias({ ...prev, ...(ov as Record<string, unknown>) }));
    }
  }
  // Apply bookState overlay (status / currentPage / rating / favourite / opinion / startedAt / finishedAt).
  for (const [bookId, state] of Object.entries(bookState)) {
    if (!state || typeof state !== "object") continue;
    const s = state as Record<string, unknown>;
    const prev = bookById.get(bookId) ?? { id: bookId };
    const patch: Record<string, unknown> = {};
    if (s.status !== undefined) patch.status = s.status;
    if (s.currentPage !== undefined) patch.currentPage = s.currentPage;
    if (s.rating !== undefined) patch.rating = s.rating;
    if (s.favourite !== undefined) patch.isFavourite = s.favourite;
    if (s.opinion !== undefined) patch.opinion = s.opinion;
    if (s.startedAt !== undefined) patch.startedAt = s.startedAt;
    if (s.finishedAt !== undefined) patch.finishedAt = s.finishedAt;
    bookById.set(bookId, { ...prev, ...patch });
  }
  // Map -> array, narrow via BookRowSchema so invalid rows get filtered.
  const upserts: z.infer<typeof BookRowSchema>[] = [];
  for (const [, raw] of bookById) {
    const parsed = BookRowSchema.safeParse(raw);
    if (parsed.success) upserts.push(parsed.data);
  }
  const deletedIds: string[] = Array.isArray(booksShape.deletedIds)
    ? (booksShape.deletedIds as unknown[]).filter((x): x is string => typeof x === "string")
    : [];

  // Notes.
  const notes: z.infer<typeof NoteInputSchema>[] = [];
  if (Array.isArray(d.notes)) {
    for (const n of d.notes) {
      const parsed = NoteInputSchema.safeParse(n);
      if (parsed.success) notes.push(parsed.data);
    }
  }

  // Sessions.
  const sessions: z.infer<typeof SessionInputSchema>[] = [];
  if (Array.isArray(d.readingSessions)) {
    for (const s of d.readingSessions) {
      const parsed = SessionInputSchema.safeParse(s);
      if (parsed.success) sessions.push(parsed.data);
    }
  }

  // Goals.
  let goals: z.infer<typeof GoalsInputSchema> | undefined;
  if (d.goals && typeof d.goals === "object") {
    const parsed = GoalsInputSchema.safeParse(d.goals);
    if (parsed.success) goals = parsed.data;
  }

  // Deleted note ids.
  const deletedNoteIds: string[] = Array.isArray(d.notesDeleted)
    ? (d.notesDeleted as unknown[]).filter((x): x is string => typeof x === "string")
    : [];

  return { books: { upserts, deletedIds }, notes, sessions, goals, deletedNoteIds };
}
