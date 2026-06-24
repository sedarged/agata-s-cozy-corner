// Agata — single source of truth for the ChatGPT OAuth `redirect_uri`.
//
// All three OAuth routes (`/api/chatgpt/{login,callback,exchange}`) need
// the same value (the URL OpenAI redirects back to after consent). The
// default is the loopback URL — works for the paste-the-URL flow on a
// VPS that's directly reachable. On a Cloudflare-fronted public URL,
// set `CHATGPT_OAUTH_REDIRECT_URI=https://<your-domain>/api/chatgpt/callback`
// in `/etc/agata.env` so OpenAI sees the public URL.
//
// Extracting this to a module rather than three inline `const`s makes
// sure the three routes can't drift apart — `oauth-redirect-uri.spec.ts`
// pins the resolution rules.

export const DEFAULT_CHATGPT_OAUTH_REDIRECT_URI = "http://127.0.0.1:3001/api/chatgpt/callback";

export function resolveChatGptRedirectUri(): string {
  const fromEnv = process.env.CHATGPT_OAUTH_REDIRECT_URI?.trim();
  if (!fromEnv || fromEnv.length === 0) return DEFAULT_CHATGPT_OAUTH_REDIRECT_URI;
  // Guard against silent typos / control-char injection. The value is
  // embedded in the OpenAI authorize URL and (verbatim) in the public
  // /api/chatgpt/redirect-uri response, so a CRLF here could log-inject
  // or — in the worst case — smuggle headers if it ever ends up in a
  // Set-Cookie / Location header downstream.
  if (/[\r\n\t]/.test(fromEnv)) return DEFAULT_CHATGPT_OAUTH_REDIRECT_URI;
  if (!/^https?:\/\//i.test(fromEnv)) return DEFAULT_CHATGPT_OAUTH_REDIRECT_URI;
  return fromEnv;
}
