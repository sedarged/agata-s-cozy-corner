// Agata — `POST /api/openai-key/save`
//
// Validates the body with OpenAIKeyInputSchema and persists the key
// (encrypted) + model (plaintext) to the settings store. Returns the
// masked key so the UI can update its state without a refetch.
import { createFileRoute } from "@tanstack/react-router";

import { OpenAIKeyInputSchema } from "@/lib/api/schemas";
import { saveOpenAIKey } from "@/lib/openai-key-store.server";
import { maskOpenAIKey } from "@/components/OpenAIKeyCard.helpers";

export const Route = createFileRoute("/api/openai-key/save")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        let body: unknown;
        try {
          body = await request.json();
        } catch {
          return Response.json({ error: "Invalid JSON" }, { status: 400 });
        }
        const parsed = OpenAIKeyInputSchema.safeParse(body);
        if (!parsed.success) {
          return Response.json(
            { error: "Invalid body", details: parsed.error.issues },
            { status: 400 },
          );
        }
        try {
          await saveOpenAIKey(parsed.data);
        } catch (err) {
          if (err instanceof Error && err.message.startsWith("AGATA_SECRETS_KEY")) {
            return Response.json({ error: "missing-encryption-key" }, { status: 500 });
          }
          throw err;
        }
        return Response.json({
          ok: true,
          model: parsed.data.model,
          masked: maskOpenAIKey(parsed.data.apiKey),
        });
      },
    },
  },
});
