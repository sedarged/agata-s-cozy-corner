// Agata — pure decision function for the /gigi page.
//
// User requirement (2026-06-24): when the user lands on /gigi without
// ChatGPT OAuth connected, the page must show ONLY the OAuth connect
// card — no WELCOME message, no prompt chips, no chat composer. The
// previous behaviour rendered the chat UI first, which made clicking
// the input produce a confusing 503 "Gigi nie jest jeszcze
// skonfigurowana" error.
//
// Extracted from the React component so it's unit-testable without
// a JSDOM/render pass (the project uses `node:test` + `assert/strict`).

export type GigiViewState = "loading" | "needs-oauth" | "ready";

export interface GigiViewStateInput {
  /**
   * The result of `GET /api/chatgpt/status`, or `null` if the query is
   * still in flight (loading) / errored and we don't yet know the
   * connection state. `null` → "loading" so the page can show a
   * spinner instead of flashing the OAuth gate on every navigation.
   */
  status: null | { connected: boolean; accountId?: string; expiresAt?: number };
}

export function getGigiViewState({ status }: GigiViewStateInput): GigiViewState {
  if (status === null) return "loading";
  if (!status.connected) return "needs-oauth";
  // NB: we do NOT inspect `status.expiresAt` here. A token whose
  // expiresAt is in the past still reports `connected: true` at the
  // status layer (the encrypted store hasn't been refreshed yet), so
  // the gate would show "ready" and the chat composer would be visible.
  // The first /api/chat call then fails with 401 and the existing
  // error toast in GigiChat surfaces "Gigi jest zabezpieczona.".
  // That's a deliberate trade-off: simpler state machine here, the
  // server is the source of truth for token validity.
  return "ready";
}
