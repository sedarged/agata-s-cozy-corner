// Agata — Pure helpers for `ChatGPTConnectCard`.
//
// Extracted so they're importable from `node:test` without React/DOM,
// matching the rest of the codebase's test conventions (see package.json
// `npm test`).
//
// History: this used to live inline in `ChatGPTConnectCard.tsx` and could
// only be tested through Playwright. Splitting it out makes the URL parser,
// expiry formatter, and mount-time toast flag logic unit-testable.

/**
 * Parse `?code=...&state=...` out of a pasted URL or `code state` pair.
 * Returns null when nothing parseable is found.
 */
export function parsePaste(raw: string): { code: string; state: string } | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  // Try as URL first.
  try {
    const u = new URL(trimmed);
    const code = u.searchParams.get("code");
    const state = u.searchParams.get("state");
    if (code && state) return { code, state };
  } catch {
    /* not a URL */
  }
  // Fallback: "code state" on two lines (or two halves of a single line).
  const parts = trimmed.split(/[\s?&]+/).filter(Boolean);
  if (parts.length >= 2) {
    const code = parts.find((p) => p.startsWith("code="))?.slice("code=".length);
    const state = parts.find((p) => p.startsWith("state="))?.slice("state=".length);
    if (code && state) return { code, state };
  }
  return null;
}

/** Human-readable "expires in X" — Polish. `now` is injected for tests. */
export function formatExpiry(expiresAt: number | undefined, now: number = Date.now()): string {
  if (!expiresAt) return "—";
  const ms = expiresAt - now;
  if (ms <= 0) return "wygasł";
  const min = Math.round(ms / 60_000);
  if (min < 60) return `wygasa za ${min} min`;
  const hr = Math.round(min / 60);
  return `wygasa za ${hr} godz.`;
}

const URL_PARAMS_TO_CLEAN = ["chatgpt", "account", "reason", "msg"] as const;

/**
 * Decide whether the URL flag should drive a toast on Settings mount.
 * Returns the cleaned URL when a flag was present, or `null` when the URL
 * did not carry a chatgpt flag (so the caller shouldn't touch history).
 *
 * History note: the original implementation only fetched status when the
 * flag was set, which meant the card got stuck on "Ładowanie statusu
 * ChatGPT…" on first paint. Status fetching is now decoupled from the
 * toast logic — only the URL cleanup + toast decision goes through this
 * helper.
 */
export function pickUrlCleanup(href: string): string | null {
  const flag = new URL(href).searchParams.get("chatgpt");
  if (!flag) return null;
  const cleaned = new URL(href);
  for (const k of URL_PARAMS_TO_CLEAN) cleaned.searchParams.delete(k);
  return cleaned.toString();
}

/**
 * Build the loopback redirect_uri placeholder shown in the paste-the-URL
 * hint *before* the live `/api/chatgpt/redirect-uri` response arrives.
 *
 * Must be derived from the live window location so the placeholder is
 * accurate on a non-default port (the VPS now binds PORT=3002 because
 * PiperWebsite's vite dev auto-bumps to 3001 when 3000 is taken — see
 * memory `agata-port-and-tunnel-mode.md`). A hard-coded `127.0.0.1:3001`
 * would have users paste a URL that points nowhere on the VPS.
 *
 * Returns `""` when no window-like object is available (SSR).
 */
export function initialLoopbackRedirectUri(loc: {
  protocol: string;
  hostname: string;
  port: string;
}): string {
  if (!loc.hostname) return "";
  const portPart = loc.port ? `:${loc.port}` : "";
  return `${loc.protocol}//${loc.hostname}${portPart}/api/chatgpt/callback`;
}
