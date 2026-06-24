// Agata — `GET /api/chatgpt/redirect-uri`
//
// Returns the public-facing redirect_uri the OAuth flow expects. Used by
// `ChatGPTConnectCard.tsx` to render a domain-accurate "paste this URL
// from the address bar" hint instead of hard-coding `127.0.0.1:3001`.
//
// In production behind Cloudflare Tunnel, set
// `CHATGPT_OAUTH_REDIRECT_URI=https://mycozylibary.com/api/chatgpt/callback`
// in `/etc/agata.env` so this returns the public URL. Default is the
// loopback URL (paste-the-URL flow on a VPS that's directly reachable).
//
// This endpoint is intentionally public (no auth) — the value is the
// same one already embedded in the authorize URL we send to OpenAI, so
// exposing it gives an attacker nothing they couldn't already see by
// starting the OAuth flow themselves.
import { createFileRoute } from "@tanstack/react-router";
import { resolveChatGptRedirectUri } from "@/lib/gigi/oauth-redirect-uri";

export const Route = createFileRoute("/api/chatgpt/redirect-uri")({
  server: {
    handlers: {
      GET: () => {
        return new Response(JSON.stringify({ uri: resolveChatGptRedirectUri() }), {
          status: 200,
          headers: {
            "content-type": "application/json; charset=utf-8",
            "cache-control": "no-store",
          },
        });
      },
    },
  },
});
