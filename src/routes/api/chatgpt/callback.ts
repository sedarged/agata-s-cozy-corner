// Agata — `GET /api/chatgpt/callback`
//
// The OpenAI auth server redirects the user's browser here after consent.
// We verify `state` against the cookie, exchange the `code` for a token,
// encrypt + persist it, then redirect to Settings with a status flag.
//
// On failure we redirect to Settings with an error code so the UI can
// surface a translated message instead of dumping a stack trace.
import { createFileRoute } from "@tanstack/react-router";

import { computeExpiresAt, extractAccountIdFromIdToken } from "@/lib/gigi/oauth-chatgpt";
import { exchangeCodeForToken } from "@/lib/gigi/oauth-chatgpt.flow";
import { resolveChatGptRedirectUri } from "@/lib/gigi/oauth-redirect-uri";
import { saveStoredToken } from "@/lib/gigi/oauth-chatgpt.server";
import { parseCookieHeader, serializeClearCookie } from "@/lib/http/cookies";

const SETTINGS_BASE = "/settings?chatgpt=";

interface PendingOAuth {
  state: string;
  verifier: string;
}

function redirect(target: string, extraHeaders: Record<string, string> = {}): Response {
  return new Response(null, { status: 302, headers: { location: target, ...extraHeaders } });
}

function readPending(request: Request): PendingOAuth | undefined {
  const cookies = parseCookieHeader(request.headers.get("cookie"));
  const raw = cookies["gigi.oauth"];
  if (!raw) return undefined;
  try {
    const parsed = JSON.parse(raw) as { state?: string; verifier?: string };
    if (typeof parsed.state === "string" && typeof parsed.verifier === "string") {
      return { state: parsed.state, verifier: parsed.verifier };
    }
  } catch {
    // Malformed cookie — fall through.
  }
  return undefined;
}

export const Route = createFileRoute("/api/chatgpt/callback")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const code = url.searchParams.get("code");
        const state = url.searchParams.get("state");
        const error = url.searchParams.get("error");

        const clearCookie = serializeClearCookie("gigi.oauth");

        if (error) {
          return redirect(`${SETTINGS_BASE}error&reason=${encodeURIComponent(error)}`, {
            "set-cookie": clearCookie,
          });
        }
        if (!code || !state) {
          return redirect(`${SETTINGS_BASE}error&reason=missing_params`, {
            "set-cookie": clearCookie,
          });
        }

        const pending = readPending(request);
        if (!pending) {
          return redirect(`${SETTINGS_BASE}error&reason=expired`, {
            "set-cookie": clearCookie,
          });
        }
        if (pending.state !== state) {
          return redirect(`${SETTINGS_BASE}error&reason=state_mismatch`, {
            "set-cookie": clearCookie,
          });
        }

        try {
          const parsed = await exchangeCodeForToken({
            clientId: process.env.CHATGPT_OAUTH_CLIENT_ID ?? "app_EMoamEEZ73f0CkXaXp7hrann",
            code,
            codeVerifier: pending.verifier,
            redirectUri: resolveChatGptRedirectUri(),
          });
          const accountId = extractAccountIdFromIdToken(parsed.idToken ?? "") ?? "unknown";
          await saveStoredToken({
            accessToken: parsed.accessToken,
            refreshToken: parsed.refreshToken,
            expiresAt: computeExpiresAt(Date.now(), parsed.expiresIn),
            accountId,
          });
          return redirect(`${SETTINGS_BASE}connected&account=${encodeURIComponent(accountId)}`, {
            "set-cookie": clearCookie,
          });
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
          return redirect(
            `${SETTINGS_BASE}error&reason=exchange_failed&msg=${encodeURIComponent(msg.slice(0, 200))}`,
            { "set-cookie": clearCookie },
          );
        }
      },
    },
  },
});
