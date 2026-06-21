// Agata — server functions for backup import (preview + apply).
// Same wire format as the legacy localStorage import in src/lib/backup.ts so a
// backup JSON exported from one device can be replayed onto the server.
//
// Project rule: "Import danych ma pokazać liczby do potwierdzenia".
// `previewImport` returns counts; `applyImport` is the write.
//
// Modes:
//   - preview: dry-run, counts only (default; never mutates).
//   - merge:   upsert books/notes/sessions, mirror tombstones,
//              optionally refresh goals if the payload has any.
//   - replace: drop notes (incl. tombstones) + sessions + books, then upsert.
//
// Drafts + handwritingPrefs are stored in the `settings` table so a
// server-side import does not silently drop them on a clean install.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import * as booksRepo from "@/lib/db/repositories/books";
import * as notesRepo from "@/lib/db/repositories/notes";
import * as sessionsRepo from "@/lib/db/repositories/reading-sessions";
import * as goalsRepo from "@/lib/db/repositories/goals";
import {
  BackupPayloadSchema,
  ImportModeSchema,
  normaliseBackup,
  previewBackup,
  type ImportPreview,
} from "@/lib/api/import-schema";

const SettingsKeySchema = z.object({ key: z.string().min(1) });
const DraftsKey = "agata.imported.drafts";
const HandwritingKey = "agata.imported.handwritingPrefs";
const NOTE_DRAFT_PREFIX = "agata-note-draft-";

function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" },
  });
}

const BodySchema = z.object({
  payload: BackupPayloadSchema,
  mode: ImportModeSchema.default("preview"),
});

export type ApplyResult = {
  ok: boolean;
  mode: "merge" | "replace" | "preview";
  counts: { books: number; notes: number; sessions: number; goals: number };
  errors: string[];
};

// ---------- preview ----------

export const previewImport = createServerFn({ method: "POST" })
  .validator(BodySchema)
  .handler(async ({ data }): Promise<ImportPreview> => {
    return previewBackup(data.payload);
  });

// ---------- apply ----------

export const applyImport = createServerFn({ method: "POST" })
  .validator(BodySchema)
  .handler(async ({ data }): Promise<ApplyResult> => {
    const { payload, mode } = data;
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
    if (mode === "replace") {
      try {
        sessionsRepo.deleteAllSessions();
        notesRepo.deleteAllNotes();
        const allBooks = await booksRepo.listBooks();
        for (const b of allBooks) {
          try {
            await booksRepo.deleteBook(b.id);
          } catch (e) {
            errors.push(`books.delete(${b.id}): ${(e as Error).message}`);
          }
        }
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
  });

// Re-export helpers used by the Settings UI.
export { SettingsKeySchema };
export { jsonResponse };
