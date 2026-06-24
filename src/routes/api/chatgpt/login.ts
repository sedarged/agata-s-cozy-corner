// Agata — `GET /api/chatgpt/login`
//
// Starts the OAuth 2.0 + PKCE flow against `https://auth.openai.com`.
// We generate a fresh verifier + state, stash the verifier in a short
// httpOnly cookie, and 302 the browser to the authorize URL.
//
// After the user consents, the OpenAI auth server redirects back to
// `redirect_uri` (either the server callback OR a paste-code flow where
// the URL ends up in `/settings?code=...&state=...` and the user clicks
// "Zatwierdź" which POSTs to `/api/chatgpt/exchange`).
import { createFileRoute } from "@tanstack/react-router";
import { randomBytes } from "node:crypto";

import {
  buildAuthorizeUrl,
  DEFAULT_OAUTH_CLIENT_ID,
  DEFAULT_OAUTH_SCOPE,
  generatePkcePair,
} from "@/lib/gigi/oauth-chatgpt";
import { resolveChatGptRedirectUri } from "@/lib/gigi/oauth-redirect-uri";
import { isHttpsRequest, serializeSetCookie } from "@/lib/http/cookies";

const SETTINGS_REDIRECT = "/settings?chatgpt=connecting";

export const Route = createFileRoute("/api/chatgpt/login")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const { verifier, challenge } = generatePkcePair();
        // state binds the callback to *this* login attempt (CSRF).
        const state = randomBytes(32).toString("base64url");
        const url = buildAuthorizeUrl({
          clientId: DEFAULT_OAUTH_CLIENT_ID,
          redirectUri: resolveChatGptRedirectUri(),
          state,
          codeChallenge: challenge,
          scope: DEFAULT_OAUTH_SCOPE,
        });

        // If the user-agent is a browser we 302 to the authorize URL
        // with the verifier cookie. If it's a curl/PasteCode flow we
        // redirect straight to the Settings page with a "use the URL
        // bar" hint — the user pastes the redirected URL into Settings.
        const userAgent = request.headers.get("user-agent") ?? "";
        const looksLikeBrowser = /Mozilla|Chrome|Safari|Edg\//i.test(userAgent);

        if (looksLikeBrowser) {
          const cookie = serializeSetCookie({
            name: "gigi.oauth",
            value: encodeURIComponent(JSON.stringify({ state, verifier })),
            secure: isHttpsRequest(request),
          });
          return new Response(null, {
            status: 302,
            headers: {
              location: url,
              "set-cookie": cookie,
            },
          });
        }

        // No browser: render a tiny HTML page that links to the authorize
        // URL and to the paste-code Settings page. The user can open
        // either, then paste the redirected URL back into Settings.
        const html = `<!doctype html>
<html lang="pl">
<head>
<meta charset="utf-8">
<title>Połącz ChatGPT</title>
<style>body{font-family:system-ui;max-width:560px;margin:40px auto;padding:0 16px;line-height:1.5}</style>
</head>
<body>
<h1>Połącz konto ChatGPT</h1>
<p>Otwórz <a href="${url}">link do autoryzacji</a> w przeglądarce, zaloguj się i kliknij <em>Authorize</em>. Po przekierowaniu skopiuj pełny adres URL z paska przeglądarki i wklej go w Ustawieniach → <a href="${SETTINGS_REDIRECT}">Połącz ChatGPT</a>.</p>
<p>Stan logowania: <code>${state}</code></p>
</body>
</html>`;
        return new Response(html, {
          status: 200,
          headers: { "content-type": "text/html; charset=utf-8" },
        });
      },
    },
  },
});
