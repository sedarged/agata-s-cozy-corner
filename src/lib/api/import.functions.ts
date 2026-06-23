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
//
// The actual side-effecting logic lives in `@/lib/api/import-logic` so the
// pipeline can be unit-tested without standing up the Start context. This
// file is a thin `createServerFn` adapter that delegates to it.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { applyImport as applyImportCore, type ApplyResult } from "@/lib/api/import-logic";
import {
  BackupPayloadSchema,
  ImportModeSchema,
  previewBackup,
  type ImportPreview,
} from "@/lib/api/import-schema";

const SettingsKeySchema = z.object({ key: z.string().min(1) });

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

// ---------- preview ----------

export const previewImport = createServerFn({ method: "POST" })
  .validator(BodySchema)
  .handler(async ({ data }): Promise<ImportPreview> => previewBackup(data.payload));

// ---------- apply ----------

export const applyImport = createServerFn({ method: "POST" })
  .validator(BodySchema)
  .handler(async ({ data }): Promise<ApplyResult> => applyImportCore(data.payload, data.mode));

// Re-export helpers used by the Settings UI.
export { SettingsKeySchema };
export { jsonResponse };
