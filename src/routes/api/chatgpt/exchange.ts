// Agata — `POST /api/chatgpt/exchange`
//
// Accepts `{ code, state }` from the Settings UI (paste-code flow). We
// look up the matching pending verifier from the `gigi.oauth` cookie
// (set by /api/chatgpt/login), exchange the code, persist, return JSON.
//
// This endpoint is the mobile/keyboard-friendly alternative to the
// browser-callback flow: the user pastes the full redirected URL from
// the address bar and we do the rest.
import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

import { computeExpiresAt, extractAccountIdFromIdToken } from "@/lib/gigi/oauth-chatgpt";
import { exchangeCodeForToken } from "@/lib/gigi/oauth-chatgpt.flow";
import { saveStoredToken } from "@/lib/gigi/oauth-chatgpt.server";
import { parseCookieHeader, serializeClearCookie } from "@/lib/http/cookies";

const REDIRECT_URI =
  process.env.CHATGPT_OAUTH_REDIRECT_URI ?? "http://127.0.0.1:3001/api/chatgpt/callback";

const Body = z.object({
  code: z.string().min(1).max(2048),
  state: z.string().min(1).max(2048),
});

function json(data: unknown, status = 200, extraHeaders: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", ...extraHeaders },
  });
}

export const Route = createFileRoute("/api/chatgpt/exchange")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        let body: unknown;
        try {
          body = await request.json();
        } catch {
          return json({ ok: false, error: "Invalid JSON" }, 400);
        }
        const parsed = Body.safeParse(body);
        if (!parsed.success) {
          return json({ ok: false, error: "Invalid body", details: parsed.error.issues }, 400);
        }
        const { code, state } = parsed.data;

        const cookies = parseCookieHeader(request.headers.get("cookie"));
        const raw = cookies["gigi.oauth"];
        const clearCookie = serializeClearCookie("gigi.oauth");
        if (!raw) {
          return json(
            {
              ok: false,
              error: "No pending OAuth flow (cookie expired). Restart from /api/chatgpt/login.",
            },
            400,
            { "set-cookie": clearCookie },
          );
        }
        let pending: { state?: string; verifier?: string };
        try {
          pending = JSON.parse(raw) as { state?: string; verifier?: string };
        } catch {
          return json({ ok: false, error: "Malformed OAuth cookie" }, 400, {
            "set-cookie": clearCookie,
          });
        }
        if (pending.state !== state || !pending.verifier) {
          return json({ ok: false, error: "State mismatch" }, 400, {
            "set-cookie": clearCookie,
          });
        }
        try {
          const tok = await exchangeCodeForToken({
            clientId: process.env.CHATGPT_OAUTH_CLIENT_ID ?? "app_EMoamEEZ73f0CkXaXp7hrann",
            code,
            codeVerifier: pending.verifier,
            redirectUri: REDIRECT_URI,
          });
          const accountId = extractAccountIdFromIdToken(tok.idToken ?? "") ?? "unknown";
          const expiresAt = computeExpiresAt(Date.now(), tok.expiresIn);
          await saveStoredToken({
            accessToken: tok.accessToken,
            refreshToken: tok.refreshToken,
            expiresAt,
            accountId,
          });
          return json({ ok: true, accountId, expiresAt }, 200, {
            "set-cookie": clearCookie,
          });
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
          return json({ ok: false, error: `Exchange failed: ${msg.slice(0, 200)}` }, 502, {
            "set-cookie": clearCookie,
          });
        }
      },
    },
  },
});
