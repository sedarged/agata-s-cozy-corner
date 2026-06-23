// Agata — `POST /api/chatgpt/disconnect`
//
// Clears the encrypted OAuth token from the settings store. The user
// can reconnect any time via `/api/chatgpt/login`.
import { createFileRoute } from "@tanstack/react-router";

import { clearStoredToken } from "@/lib/gigi/oauth-chatgpt.server";

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" },
  });
}

export const Route = createFileRoute("/api/chatgpt/disconnect")({
  server: {
    handlers: {
      POST: async () => {
        await clearStoredToken();
        return json({ ok: true });
      },
    },
  },
});
