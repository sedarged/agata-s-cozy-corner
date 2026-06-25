// Agata — `GET /api/openai-key/status`
//
// Reports which OpenAI API key source is currently in effect so the
// Settings card can render the right branch (none / stored / env).
// Precedence: OPENAI_API_KEY env wins over the stored UI key.
import { createFileRoute } from "@tanstack/react-router";

import { getStoredOpenAIKey } from "@/lib/openai-key-store.server";
import { maskOpenAIKey } from "@/components/OpenAIKeyCard.helpers";

export const Route = createFileRoute("/api/openai-key/status")({
  server: {
    handlers: {
      GET: async () => {
        const envKey = process.env.OPENAI_API_KEY?.trim();
        if (envKey) {
          return Response.json({
            configured: true,
            source: "env" as const,
          });
        }
        const stored = await getStoredOpenAIKey();
        if (stored) {
          return Response.json({
            configured: true,
            source: "stored" as const,
            model: stored.model,
            masked: maskOpenAIKey(stored.apiKey),
          });
        }
        return Response.json({ configured: false, source: "none" as const });
      },
    },
  },
});
