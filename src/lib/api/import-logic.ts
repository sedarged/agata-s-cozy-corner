// Agata — testable apply logic for the backup-import server functions.
//
// This module is the side-effecting half of the import pipeline. It is
// deliberately split out of `import-schema.ts` (pure validation/normalisation)
// and `import.functions.ts` (the `createServerFn` RPC wrapper) so that the
// import pipeline can be exercised from a test runner without standing up the
// TanStack Start async-local-storage context.
//
// Behaviour contract (preserved from the original `import.functions.ts`):
//   - preview: never mutates; returns counts only
//   - merge:   upsert books/notes/sessions, mirror tombstones,
//              optionally refresh goals if the payload has any
//   - replace: drop notes (incl. tombstones) + sessions + books, then upsert
//
// Drafts and handwritingPrefs are persisted into the `settings` table so a
// server-side import on a clean install does not silently drop them. Drafts
// are filtered to the legacy `agata-note-draft-` prefix to keep settings
// clean.
import * as booksRepo from "@/lib/db/repositories/books";
import * as notesRepo from "@/lib/db/repositories/notes";
import * as sessionsRepo from "@/lib/db/repositories/reading-sessions";
import * as goalsRepo from "@/lib/db/repositories/goals";
import { normaliseBackup, type BackupPayload, type ImportMode } from "@/lib/api/import-schema";

const DraftsKey = "agata.imported.drafts";
const HandwritingKey = "agata.imported.handwritingPrefs";
const NOTE_DRAFT_PREFIX = "agata-note-draft-";

export interface ApplyCounts {
  books: number;
  notes: number;
  sessions: number;
  goals: number;
}

export interface ApplyResult {
  ok: boolean;
  mode: ImportMode;
  counts: ApplyCounts;
  errors: string[];
}

/**
 * Apply a backup payload to the server-side DB.
 *
 * Tests call this directly (no Start context required). The `*.functions.ts`
 * wrapper is a thin `createServerFn` adapter that delegates here.
 */
export async function applyImport(payload: BackupPayload, mode: ImportMode): Promise<ApplyResult> {
  if (mode === "preview") {
    // Defensive — the UI should not call this with preview, but we noop
    // rather than write anything by accident.
    return {
      ok: true,
      mode: "preview",
      counts: { books: 0, notes: 0, sessions: 0, goals: 0 },
      errors: [],
    };
  }
  const norm = normaliseBackup(payload);
  const errors: string[] = [];

  // Wipe on replace — bulk operations only, no per-row JS loop.
  //
  // `notes.book_id` and `reading_sessions.book_id` declare ON DELETE CASCADE
  // on books, so deleting books would cascade-drop the children anyway. We
  // wipe children first so the child table wipes can also clear dependent
  // state in one shot (e.g. `deleteAllNotes` clears `notes_deleted`
  // tombstones) — without that, a `books`-first wipe would leave tombstone
  // rows behind. A single `DELETE FROM books` replaces the old per-row
  // `listBooks()` + `deleteBook(id)` loop, avoiding N round-trips on large
  // libraries.
  if (mode === "replace") {
    try {
      sessionsRepo.deleteAllSessions();
      notesRepo.deleteAllNotes();
      booksRepo.deleteAllBooks();
    } catch (e) {
      errors.push(`replace.wipe: ${(e as Error).message}`);
    }
  }

  // Books (idempotent — upsertBook uses onConflictDoUpdate).
  let bookCount = 0;
  for (const b of norm.books.upserts) {
    try {
      await booksRepo.upsertBook(b);
      bookCount++;
    } catch (e) {
      errors.push(`books.upsert(${b.id}): ${(e as Error).message}`);
    }
  }
  // Mirror locally-deleted book ids.
  for (const id of norm.books.deletedIds) {
    try {
      await booksRepo.deleteBook(id);
    } catch {
      /* not present is fine */
    }
  }

  // Notes (idempotent — upsertNote preserves createdAt).
  let noteCount = 0;
  for (const n of norm.notes) {
    try {
      await notesRepo.upsertNote(n);
      noteCount++;
    } catch (e) {
      errors.push(`notes.upsert(${n.id}): ${(e as Error).message}`);
    }
  }
  // Mirror note tombstones from the payload.
  for (const id of norm.deletedNoteIds) {
    try {
      await notesRepo.markNoteDeleted(id);
    } catch (e) {
      errors.push(`notes.tombstone(${id}): ${(e as Error).message}`);
    }
  }

  // Reading sessions (idempotent — upsertSession).
  let sessionCount = 0;
  for (const s of norm.sessions) {
    try {
      await sessionsRepo.upsertSession(s);
      sessionCount++;
    } catch (e) {
      errors.push(`sessions.upsert(${s.id}): ${(e as Error).message}`);
    }
  }

  // Goals — only refresh if the payload included any.
  let goalCount = 0;
  if (
    norm.goals &&
    (norm.goals.yearlyBooks !== undefined || norm.goals.weeklyMinutes !== undefined)
  ) {
    try {
      await goalsRepo.setGoals(norm.goals);
      goalCount = 1;
    } catch (e) {
      errors.push(`goals.setGoals: ${(e as Error).message}`);
    }
  }

  // Persist drafts + handwriting prefs into the settings table so a
  // server-side import does not silently drop them. Filter drafts to the
  // legacy `agata-note-draft-` prefix to keep settings clean.
  if (payload.data.noteDrafts && typeof payload.data.noteDrafts === "object") {
    const filtered: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(payload.data.noteDrafts)) {
      if (k.startsWith(NOTE_DRAFT_PREFIX)) filtered[k] = v;
    }
    if (Object.keys(filtered).length > 0) {
      try {
        await goalsRepo.setSetting(DraftsKey, filtered);
      } catch (e) {
        errors.push(`settings.set(drafts): ${(e as Error).message}`);
      }
    }
  }
  if (payload.data.handwritingPrefs) {
    try {
      await goalsRepo.setSetting(
        HandwritingKey,
        payload.data.handwritingPrefs as Record<string, unknown>,
      );
    } catch (e) {
      errors.push(`settings.set(handwriting): ${(e as Error).message}`);
    }
  }

  return {
    ok: errors.length === 0,
    mode,
    counts: { books: bookCount, notes: noteCount, sessions: sessionCount, goals: goalCount },
    errors,
  };
}
