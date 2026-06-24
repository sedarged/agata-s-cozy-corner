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
   * The result of `GET /api/chatgpt/status`, or `null` / `undefined` if
   * the query is still in flight (loading) / errored and we don't yet
   * know the connection state. `null`/`undefined` → "loading" so the
   * page can show a spinner instead of flashing the OAuth gate on every
   * navigation.
   */
  status: null | undefined | { connected: boolean; accountId?: string; expiresAt?: number };
  /**
   * `true` when the React Query exhausted its retries and the
   * `/api/chatgpt/status` request failed. We treat this as
   * "needs-oauth" so the user is never stuck on the spinner — it's a
   * safer fallback (the OAuth gate has its own retry/connect path) than
   * a perpetual loading state. Defaults to `false` so existing callers
   * don't have to pass it.
   */
  isError?: boolean;
}

export function getGigiViewState({ status, isError = false }: GigiViewStateInput): GigiViewState {
  // Code-review finding W1 (2026-06-24): if the query exhausted its
  // retries, fall through to the OAuth gate. Otherwise the user is
  // trapped on the loading spinner with no recovery affordance — the
  // OAuth gate has its own "Spróbuj ponownie" + connect path.
  if (isError) return "needs-oauth";
  // `== null` (not `=== null`) so an `undefined` value is treated the
  // same as `null` — defensive against a caller widening the type, a
  // React Query returning `undefined` for an unfired query, or a
  // consumer that forgets to spread the data default. The mutation
  // test `treats undefined status the same as null` pins this.
  if (status == null) return "loading";
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
