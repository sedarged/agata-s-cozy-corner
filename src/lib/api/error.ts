// Agata — shared JSON response helper.
//
// L1: every JSON response (success or error) MUST carry
// `X-Content-Type-Options: nosniff` so legacy browsers / curl-style agents
// don't MIME-sniff a body that an attacker can influence into HTML /
// script. We centralise the header here so a new response site can't
// accidentally forget it.
export const NO_SNIFF = "nosniff" as const;

/**
 * Build a JSON Response. Always sets `content-type: application/json` and
 * `X-Content-Type-Options: nosniff`. Caller-provided `headers` are merged
 * AFTER the safety headers so the contract is preserved even if a caller
 * accidentally overrides them.
 *
 * Default status is 200 (the standard Response default); callers that need
 * a non-2xx code (e.g. 400 / 403 / 503) pass `init.status`.
 */
export function apiJson(data: unknown, init?: ResponseInit): Response {
  return new Response(JSON.stringify(data), {
    ...init,
    headers: {
      // Caller-provided headers first so the safety headers below always
      // win — a caller can't accidentally (or maliciously) flip the
      // X-Content-Type-Options policy off by passing their own value.
      ...(init?.headers ?? {}),
      "content-type": "application/json; charset=utf-8",
      "X-Content-Type-Options": NO_SNIFF,
    },
  });
}