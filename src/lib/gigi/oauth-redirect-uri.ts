// Agata — single source of truth for the ChatGPT OAuth `redirect_uri`.
//
// All three OAuth routes (`/api/chatgpt/{login,callback,exchange}`) need
// the same value (the URL OpenAI redirects back to after consent). The
// default is the loopback URL — works for the paste-the-URL flow on a
// VPS that's directly reachable. On a Cloudflare-fronted public URL,
// set `CHATGPT_OAUTH_REDIRECT_URI=https://<your-domain>/api/chatgpt/callback`
// in `/etc/agata.env` so OpenAI sees the public URL.
//
// 2026-06-24 fix: the loopback port is read from `process.env.PORT` so the
// default matches the port Agata is actually bound to. On the VPS that's
// PORT=3002 (moved off 3001 because PiperWebsite's vite dev auto-bumps
// to 3001 when 3000 is taken; both apps coexist). The previous hard-coded
// 3001 sent OpenAI back to a port nothing listened on after consent →
// connection refused → "OAuth callback failed". See memory
// `agata-port-and-tunnel-mode.md`.
//
// Extracting this to a module rather than three inline `const`s makes
// sure the three routes can't drift apart — `oauth-redirect-uri.spec.ts`
// pins the resolution rules.

// Agata's actual production port on the VPS (per /etc/agata.env). Used as
// the loopback default only when `PORT` is not set — dev rarely sets it,
// so this is the "vps-default" fallback. Operators overriding PORT must
// also keep these two in sync (or set CHATGPT_OAUTH_REDIRECT_URI explicitly).
const DEFAULT_AGATA_PORT = "3002";

/**
 * Build the loopback redirect_uri from the live `PORT` env var.
 * Exported for the `/api/chatgpt/redirect-uri` endpoint which serves the
 * value verbatim to `ChatGPTConnectCard.tsx` — the resolver guarantees
 * it never returns an empty string.
 *
 * PORT is validated against `/^\d+$/` before interpolation so a CRLF
 * injected via `/etc/agata.env` (or a non-numeric typo) cannot leak
 * control characters or extra segments into the URL that ends up in
 * the OpenAI authorize URL and the public `/api/chatgpt/redirect-uri`
 * response body. Falls back to the VPS default when the value is
 * missing, empty, or malformed.
 */
export function defaultLoopbackRedirectUri(): string {
  const raw = process.env.PORT?.trim();
  const port = raw && /^\d+$/.test(raw) ? raw : DEFAULT_AGATA_PORT;
  return `http://127.0.0.1:${port}/api/chatgpt/callback`;
}

/**
 * Static default kept for backward compatibility with any caller that
 * imported the old constant. Prefer `defaultLoopbackRedirectUri()` which
 * reads the live `PORT`. This constant is frozen to the current VPS port
 * so any caller that hard-codes it still gets a URL pointing at a real
 * listener (rather than the pre-fix 3001, which didn't exist on this VPS).
 */
export const DEFAULT_CHATGPT_OAUTH_REDIRECT_URI = `http://127.0.0.1:${DEFAULT_AGATA_PORT}/api/chatgpt/callback`;

export function resolveChatGptRedirectUri(): string {
  const fromEnv = process.env.CHATGPT_OAUTH_REDIRECT_URI?.trim();
  if (!fromEnv || fromEnv.length === 0) return defaultLoopbackRedirectUri();
  // Guard against silent typos / control-char injection. The value is
  // embedded in the OpenAI authorize URL and (verbatim) in the public
  // /api/chatgpt/redirect-uri response, so a CRLF here could log-inject
  // or — in the worst case — smuggle headers if it ever ends up in a
  // Set-Cookie / Location header downstream.
  if (/[\r\n\t]/.test(fromEnv)) return defaultLoopbackRedirectUri();
  if (!/^https?:\/\//i.test(fromEnv)) return defaultLoopbackRedirectUri();
  return fromEnv;
}
