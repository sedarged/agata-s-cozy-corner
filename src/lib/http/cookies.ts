// Agata — minimal cookie helpers for route handlers.
//
// The TanStack Start `Request` handler signature only gives us a standard
// `Request` (no h3 event), so we parse cookies ourselves. We support
// just enough to round-trip an OAuth state + code_verifier through the
// callback — not a full session-cookie framework.
const COOKIE_MAX_AGE_SECONDS = 600; // 10 minutes — plenty for a manual paste-code flow.

/** Parse a `cookie:` header value into a flat record. */
export function parseCookieHeader(header: string | null): Record<string, string> {
  if (!header) return {};
  const out: Record<string, string> = {};
  for (const part of header.split(";")) {
    const eq = part.indexOf("=");
    if (eq <= 0) continue;
    const name = part.slice(0, eq).trim();
    const value = part.slice(eq + 1).trim();
    if (!name) continue;
    try {
      out[name] = decodeURIComponent(value);
    } catch {
      // Malformed value — skip.
    }
  }
  return out;
}

/**
 * Build a `Set-Cookie` header value for an httpOnly + secure cookie.
 * We always set `path=/` and `httponly`; `secure` is controlled by the
 * caller (only true when the request is HTTPS, otherwise the browser
 * drops the cookie).
 */
export function serializeSetCookie(opts: {
  name: string;
  value: string;
  maxAgeSeconds?: number;
  secure?: boolean;
  sameSite?: "Strict" | "Lax" | "None";
}): string {
  const parts = [`${opts.name}=${encodeURIComponent(opts.value)}`, "Path=/", "HttpOnly"];
  parts.push(`SameSite=${opts.sameSite ?? "Lax"}`);
  const maxAge = opts.maxAgeSeconds ?? COOKIE_MAX_AGE_SECONDS;
  parts.push(`Max-Age=${maxAge}`);
  if (opts.secure) parts.push("Secure");
  return parts.join("; ");
}

/** Build a `Set-Cookie` header that clears the named cookie (zero-age). */
export function serializeClearCookie(name: string): string {
  return `${name}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`;
}

/** Detect HTTPS from the request's `x-forwarded-proto` / URL. */
export function isHttpsRequest(request: Request): boolean {
  const fwd = request.headers.get("x-forwarded-proto");
  if (fwd) return fwd.toLowerCase().includes("https");
  try {
    return new URL(request.url).protocol === "https:";
  } catch {
    return false;
  }
}
