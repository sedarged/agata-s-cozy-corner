// Agata — client-side fetcher for the OAuth `redirect_uri`.
//
// The OAuth route handlers and `ChatGPTConnectCard.tsx` both need to
// agree on the same `redirect_uri` so the user can paste the URL OpenAI
// redirects them back to. The server owns the value (via the resolver
// in `./oauth-redirect-uri.ts`); this is the client wrapper that reads
// it via `/api/chatgpt/redirect-uri`.
//
// Contract: the endpoint ALWAYS returns `{ uri: string }` with a
// non-empty `uri` (the resolver guarantees this). If we ever get
// anything else, fail loud — silently using a different URL than
// `/login` sends to OpenAI would produce a real OAuth state-mismatch
// failure that's hard to diagnose.

export async function fetchRedirectUri(): Promise<string> {
  const res = await fetch("/api/chatgpt/redirect-uri", { credentials: "same-origin" });
  if (!res.ok) throw new Error(`redirect-uri ${res.status}`);
  const data = (await res.json()) as { uri?: string };
  if (typeof data.uri !== "string" || data.uri.length === 0) {
    throw new Error("redirect-uri payload missing `uri`");
  }
  return data.uri;
}
