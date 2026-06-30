// /api/notes/:noteId/handwriting/pages — multi-page notebook for a note.
//
// GET  → HandwritingPageDTO[] (all pages, ordered by pageIndex)
// PUT  → HandwritingPageDTO   (upsert one page; bodies validated by Zod)
//
// Wire shape differs from the DB row: the client exchanges `strokes`
// (JSON-serialisable stroke array), the repo stores an opaque dataUrl.
// The pure handlers in @/lib/api/handwriting translate between the two
// and enforce the parent-note-exists invariant (404 if the note is gone).
import { createFileRoute } from "@tanstack/react-router";
import { apiJson } from "@/lib/api/error";
import { handleGetPages, handlePutPage } from "@/lib/api/handwriting";

export const Route = createFileRoute("/api/notes/$noteId/handwriting/pages")({
  server: {
    handlers: {
      GET: async ({ params }) => handleGetPages(params.noteId),
      PUT: async ({ params, request }) => {
        // Route the JSON-parse failure through apiJson so the L1 safety
        // headers (X-Content-Type-Options: nosniff) are guaranteed — every
        // other /api/* error site goes through apiJson, this one must too.
        let body: unknown;
        try {
          body = await request.json();
        } catch {
          return apiJson({ error: "invalid-body" }, { status: 400 });
        }
        return handlePutPage(params.noteId, body);
      },
    },
  },
});
