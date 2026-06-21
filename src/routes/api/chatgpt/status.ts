// Agata — `GET /api/chatgpt/status`
//
// Returns whether a ChatGPT account is connected, plus the (non-secret)
// account id and absolute expiry timestamp. Used by the Settings UI to
// render the "Połączony z kontem X · wygasa za Y" card.
import { createFileRoute } from "@tanstack/react-router";

import { getStoredToken } from "@/lib/gigi/oauth-chatgpt.server";

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" },
  });
}

export const Route = createFileRoute("/api/chatgpt/status")({
  server: {
    handlers: {
      GET: async () => {
        const token = await getStoredToken();
        if (!token) return json({ connected: false });
        return json({
          connected: true,
          accountId: token.accountId,
          expiresAt: token.expiresAt,
          hasRefreshToken: Boolean(token.refreshToken),
        });
      },
    },
  },
});
