// Agata — `POST /api/openai-key/delete`
//
// Removes the stored OpenAI key from the settings table. Idempotent —
// always returns `{ ok: true }` even when nothing was stored.
import { createFileRoute } from "@tanstack/react-router";

import { clearOpenAIKey } from "@/lib/openai-key-store.server";

export const Route = createFileRoute("/api/openai-key/delete")({
  server: {
    handlers: {
      POST: async () => {
        await clearOpenAIKey();
        return Response.json({ ok: true });
      },
    },
  },
});
