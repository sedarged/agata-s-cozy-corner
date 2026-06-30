// Agata — handwriting route handlers.
//
// Endpoints (mounted at /api/notes/$noteId/handwriting/pages and
// /api/notes/$noteId/handwriting/pages/$pageId):
//
//   GET    /api/notes/:noteId/handwriting/pages        → HandwritingPageDTO[]
//   PUT    /api/notes/:noteId/handwriting/pages        → HandwritingPageDTO   (upsert)
//   DELETE /api/notes/:noteId/handwriting/pages/:pageId → { ok: true }
//
// Wire shape (`HandwritingPageDTO`) is the JSON the React Query hooks in
// `src/lib/api/client.ts` exchange. It mirrors the DB row but stores strokes
// as a JSON string instead of a base64 PNG dataUrl — the canvas paints
// directly from stroke arrays. The handler translates between the two shapes
// on the way in (stages new page / decodes stroke JSON to a dataUrl for
// repo storage) and out (re-encodes the stored dataUrl back to strokes for
// the client).
//
// Why split the JSON-encoded strokes through a dataUrl instead of widening
// the schema: the repo column is `data_url` (TEXT) — same shape as the
// existing single-page `notes.drawingDataUrl`. Reusing the column keeps the
// migration trivial (no schema change for storage) and gives us a stable
// opaque blob that doesn't force the repo layer to know about stroke JSON.
//
// All endpoints require the parent note to exist; we 404 if it doesn't, so
// a stale id from a deleted note can't keep orphan pages alive.
import { z } from "zod";
import { apiJson } from "@/lib/api/error";
import { BackgroundRequired } from "@/lib/api/schemas";
import * as notesRepo from "@/lib/db/repositories/notes";
import * as handwritingRepo from "@/lib/db/repositories/handwriting";
import type { HandwritingPage } from "@/lib/db/repositories/handwriting";
import type { NoteRow } from "@/lib/db/types";

const IdParam = z
  .string()
  .min(1)
  .max(128)
  .regex(/^[A-Za-z0-9._-]+$/);

// `handwriting_pages.background` is NOT NULL with a default — callers must
// always send one of the 5 palette values. Hoisted from schemas.ts so the
// allowed values stay in one place (see `BACKGROUND_VALUES`).
const Background = BackgroundRequired;

const HandwritingPageInputSchema = z.object({
  id: IdParam,
  noteId: IdParam,
  pageIndex: z.number().int().nonnegative().max(10_000),
  // Strokes are an opaque JSON-serialisable value (the canvas owns the
  // shape). Cap the stringified size so a hostile payload can't push a
  // 20 MB blob into a single DB row.
  strokes: z.unknown().refine(
    (v) => {
      try {
        return JSON.stringify(v).length <= 2_000_000;
      } catch {
        return false;
      }
    },
    { message: "strokes exceeds 2 MB when JSON-serialised" },
  ),
  background: Background,
  createdAt: z.string().max(64).optional(),
  updatedAt: z.string().max(64).optional(),
});

export type HandwritingPageInput = z.infer<typeof HandwritingPageInputSchema>;

// ---- wire <-> storage translation -----------------------------------------

/** Encode the JSON-serialisable stroke array as a `data:application/json;base64,…`
 * URL so the repo can keep using the opaque `data_url` TEXT column. The
 * prefix distinguishes it from the `data:image/png;base64,…` blobs the legacy
 * single-page canvas writes — both decode safely with `Buffer.from(..., "base64")`.
 */
export function strokesToDataUrl(strokes: unknown): string {
  const json = JSON.stringify(strokes ?? []);
  return `data:application/json;base64,${Buffer.from(json, "utf8").toString("base64")}`;
}

export function dataUrlToStrokes(dataUrl: string): unknown {
  if (!dataUrl) return [];
  const marker = "base64,";
  const idx = dataUrl.indexOf(marker);
  if (idx < 0) return [];
  try {
    const raw = Buffer.from(dataUrl.slice(idx + marker.length), "base64").toString("utf8");
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

export interface HandwritingPageDTO {
  id: string;
  noteId: string;
  pageIndex: number;
  strokes: unknown;
  background: string;
  createdAt: string;
  updatedAt: string;
}

export function rowToDTO(row: HandwritingPage): HandwritingPageDTO {
  return {
    id: row.id,
    noteId: row.noteId,
    pageIndex: row.pageIndex,
    strokes: dataUrlToStrokes(row.dataUrl),
    background: row.background,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

// ---- pure handler so tests can drive it without the SQLite layer ----------

// Structural subset — partial mocks with just the methods the handlers call
// are enough. The repo modules themselves are the default when no opts are
// passed (so the createFileRoute wiring works without ceremony).
export interface HandwritingHandlersOptions {
  notesRepo?: { getNote(id: string): Promise<NoteRow | undefined> };
  handwritingRepo?: {
    listPages(noteId: string): Promise<HandwritingPage[]>;
    getPage(id: string): Promise<HandwritingPage | undefined>;
    savePage(input: {
      id: string;
      noteId: string;
      pageIndex: number;
      dataUrl: string;
      background?: string;
    }): Promise<HandwritingPage>;
    deletePage(id: string): Promise<boolean>;
    renumberPages(noteId: string): Promise<void>;
  };
}

export async function handleGetPages(
  noteId: string,
  opts: HandwritingHandlersOptions = {},
): Promise<Response> {
  const parsed = IdParam.safeParse(noteId);
  if (!parsed.success) return apiJson({ error: "invalid-note-id" }, { status: 400 });
  const notes = opts.notesRepo ?? notesRepo;
  const repo = opts.handwritingRepo ?? handwritingRepo;
  const note = await notes.getNote(parsed.data);
  if (!note) return apiJson({ error: "not-found" }, { status: 404 });
  const rows = await repo.listPages(parsed.data);
  return apiJson(rows.map(rowToDTO));
}

export async function handlePutPage(
  noteId: string,
  rawBody: unknown,
  opts: HandwritingHandlersOptions = {},
): Promise<Response> {
  const parsedId = IdParam.safeParse(noteId);
  if (!parsedId.success) return apiJson({ error: "invalid-note-id" }, { status: 400 });
  const notes = opts.notesRepo ?? notesRepo;
  const repo = opts.handwritingRepo ?? handwritingRepo;
  const note = await notes.getNote(parsedId.data);
  if (!note) return apiJson({ error: "not-found" }, { status: 404 });

  const parsedBody = HandwritingPageInputSchema.safeParse(rawBody);
  if (!parsedBody.success) {
    return apiJson({ error: "invalid-body", issues: parsedBody.error.issues }, { status: 400 });
  }
  const body = parsedBody.data;
  // Reject mismatched noteIds — caller can't write a page to a different note
  // than the URL claims.
  if (body.noteId !== parsedId.data) {
    return apiJson({ error: "note-id-mismatch" }, { status: 400 });
  }

  const row = await repo.savePage({
    id: body.id,
    noteId: body.noteId,
    pageIndex: body.pageIndex,
    dataUrl: strokesToDataUrl(body.strokes),
    background: body.background,
  });
  return apiJson(rowToDTO(row));
}

export async function handleDeletePage(
  noteId: string,
  pageId: string,
  opts: HandwritingHandlersOptions = {},
): Promise<Response> {
  const parsedNote = IdParam.safeParse(noteId);
  if (!parsedNote.success) return apiJson({ error: "invalid-note-id" }, { status: 400 });
  const parsedPage = IdParam.safeParse(pageId);
  if (!parsedPage.success) return apiJson({ error: "invalid-page-id" }, { status: 400 });
  const notes = opts.notesRepo ?? notesRepo;
  const repo = opts.handwritingRepo ?? handwritingRepo;
  const note = await notes.getNote(parsedNote.data);
  if (!note) return apiJson({ error: "not-found" }, { status: 404 });

  // Ensure the page belongs to this note before deleting — protects against a
  // caller hitting /api/notes/X/handwriting/pages/Y to delete a page that
  // actually belongs to note Z.
  const existing = await repo.getPage(parsedPage.data);
  if (!existing || existing.noteId !== parsedNote.data) {
    return apiJson({ error: "not-found" }, { status: 404 });
  }
  await repo.deletePage(parsedPage.data);
  // Keep indexes contiguous so the UI can address pages without holes.
  await repo.renumberPages(parsedNote.data);
  return apiJson({ ok: true });
}
