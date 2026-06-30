// /api/notes/:noteId/handwriting/pages/:pageId — delete a single page.
//
// Pure handler in @/lib/api/handwriting enforces:
//   - 400 if noteId or pageId fail the id allowlist
//   - 404 if the parent note doesn't exist
//   - 404 if the page exists but belongs to a different note (cross-note
//     delete can't reach a sibling's page)
//   - 200 + { ok: true } after deletePage + renumberPages (so the UI sees
//     contiguous indexes)
import { createFileRoute } from "@tanstack/react-router";
import { handleDeletePage } from "@/lib/api/handwriting";

export const Route = createFileRoute("/api/notes/$noteId/handwriting/pages/$pageId")({
  server: {
    handlers: {
      DELETE: async ({ params }) => handleDeletePage(params.noteId, params.pageId),
    },
  },
});
