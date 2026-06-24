// Agata — regression tests for the Gigi page view-state decision.
//
// User requirement (2026-06-24): on /gigi, if ChatGPT OAuth is NOT
// connected, the user must see ONLY the OAuth connect flow (the
// ChatGPTConnectCard). The WELCOME message, prompt chips, and the
// chat composer must NOT render — because clicking into the input
// while disconnected produces a confusing 503 "Gigi nie jest jeszcze
// skonfigurowana" error.
//
// The routing decision lives in `gigi-view-state.ts` (pure function)
// so this behaviour is testable without a full React render. The
// Gigi page reads the returned state and gates the chat UI behind
// `state === "ready"`.

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { getGigiViewState, type GigiViewState } from "./gigi-view-state";

describe("getGigiViewState", () => {
  it('returns "loading" when chatgpt status is unknown', () => {
    const state: GigiViewState = getGigiViewState({ status: null });
    assert.equal(state, "loading");
  });

  it('returns "needs-oauth" when chatgpt is fetched but not connected', () => {
    const state: GigiViewState = getGigiViewState({ status: { connected: false } });
    assert.equal(state, "needs-oauth");
  });

  it('returns "ready" when chatgpt is connected', () => {
    const state: GigiViewState = getGigiViewState({
      status: { connected: true, accountId: "u_123", expiresAt: 9999999999 },
    });
    assert.equal(state, "ready");
  });

  it("disconnected status with extras still returns needs-oauth (not ready)", () => {
    // Defensive: if the API ever returns disconnected with stale extras
    // (e.g. accountId from a previous session), we still must gate the UI.
    const state: GigiViewState = getGigiViewState({
      status: { connected: false, accountId: "u_123" },
    });
    assert.equal(state, "needs-oauth");
  });

  it("treats undefined status the same as null (loading)", () => {
    // Guards against a regression where the status query errors out and
    // returns `undefined` instead of `null` (e.g. before React Query
    // settles). The current type is `null | {...}`, so this case only
    // arises if a caller widens the type — the test pins the runtime
    // behaviour so a future type-tightening doesn't flip the branch.
    const state: GigiViewState = getGigiViewState({
      status: undefined as unknown as null,
    });
    assert.equal(state, "loading");
  });

  it("falls back to 'needs-oauth' when the status query errored (not stuck on spinner)", () => {
    // Code-review finding W1 (2026-06-24): without this, a transient
    // network failure that exhausts `retry: 1` traps the user on the
    // loading spinner with no recovery path. Falling back to the OAuth
    // gate is safer — the gate has its own connect / refresh / paste-URL
    // flows that the user can use to recover.
    const state: GigiViewState = getGigiViewState({
      status: undefined,
      isError: true,
    });
    assert.equal(state, "needs-oauth");
  });

  it("isError wins over a successful 'ready' status (defensive against stale data)", () => {
    // Edge case: if the query's last successful payload is still in
    // the cache AND the latest refetch errored, prefer the error path.
    // This shouldn't happen in practice (RQ replaces `data` on error)
    // but pinning the priority is cheap insurance.
    const state: GigiViewState = getGigiViewState({
      status: { connected: true, accountId: "u_123" },
      isError: true,
    });
    assert.equal(state, "needs-oauth");
  });
});
