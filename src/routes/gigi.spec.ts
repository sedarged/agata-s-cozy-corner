// Agata — regression tests for the /gigi page.
//
// User requirement (2026-06-24):
//   1. Settings must be reachable on /gigi at all times (not hidden behind
//      a chat UI that the user can't even interact with).
//   2. When ChatGPT OAuth is NOT connected, the page must show the OAuth
//      connect card FIRST — no WELCOME message, no prompt chips, no chat
//      composer — because clicking the composer while disconnected would
//      just produce a confusing 503 error from /api/chat.
//
// The view-state machine itself is pinned by `gigi-view-state.spec.ts`
// (pure function). This spec pins that the React component actually
// honours that machine — i.e. that the file is wired up so the right
// subtree renders in each branch.
//
// Project convention (see notes-filter-overflow.spec.tsx) is to test via
// string-contract assertions on the source rather than render with JSDOM.
// We follow that convention here: assertions check that the source file
// contains the required imports + the conditional structure that gates
// the chat UI behind `viewState === "ready"`.

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const source = readFileSync(resolve(here, "gigi.tsx"), "utf8");

describe("/gigi page — OAuth-first landing", () => {
  it("imports ChatGPTConnectCard so the OAuth gate can render it", () => {
    assert.match(source, /from\s+["']@\/components\/ChatGPTConnectCard["']/);
  });

  it("imports the pure view-state decision", () => {
    assert.match(source, /from\s+["']\.\/gigi-view-state["']/);
    assert.match(source, /getGigiViewState/);
  });

  it("imports the chatgpt-status query hook from the React Query client", () => {
    assert.match(source, /useChatgptStatusQuery/);
  });

  it("renders the OAuth gate ONLY when viewState === 'needs-oauth'", () => {
    // The conditional must reference the exact literal "needs-oauth" so a
    // future refactor that changes the state machine also updates the
    // gating condition. We pin the literal here rather than just any
    // reference to ChatGPTConnectCard so a regression that always renders
    // the OAuth gate (and hides the chat even when connected) still fails.
    assert.match(
      source,
      /viewState\s*===\s*["']needs-oauth["']/,
      'viewState === "needs-oauth" branch must exist',
    );
  });

  it("renders ChatGPTConnectCard ONLY inside GigiOAuthGate", () => {
    // Symmetric to the 'ready' branch test above: pin the OAuth card's
    // containment inside its gate. A regression that hoists
    // <ChatGPTConnectCard /> out of the gate (always-show bug) would
    // still pass the import + branch-existence tests, but fails here.
    //
    // The needs-oauth branch in source uses a self-closing
    // <GigiOAuthGate />, so we extract the body of `GigiOAuthGate`
    // itself and assert that <ChatGPTConnectCard /> is inside it.
    const gate = source.match(/function\s+GigiOAuthGate\s*\(\s*\)\s*\{([\s\S]*?)\n\}/);
    assert.ok(gate, "GigiOAuthGate function must exist");
    assert.match(
      gate![1],
      /<ChatGPTConnectCard\b/,
      "ChatGPTConnectCard must be inside GigiOAuthGate",
    );
  });

  it("renders the chat composer ONLY inside the 'ready' branch", () => {
    // The chat composer is the <form> with id "gigi-input" + the prompt
    // chips. We assert the ENTIRE chat subtree sits inside a
    // `viewState === "ready"` block so that disconnected users cannot
    // even see (let alone focus) the input — which is what the user
    // reported as confusing UX on 2026-06-24.
    //
    // The branch uses JSX short-circuit: `{cond && (<GigiChat ... />)}`.
    // Note the open is `&& (` and the close is `)` then `}` (the inner
    // paren closes first, then the outer JSX brace). Match that exact
    // shape so a regression that drops the gating condition is caught.
    const readyBranch = source.match(/viewState\s*===\s*["']ready["']\s*&&\s*\(([\s\S]*?)\)\s*\}/);
    assert.ok(readyBranch, 'viewState === "ready" branch must exist');
    const inside = readyBranch![1];
    assert.match(inside, /<GigiChat\b/, "GigiChat component must be inside the ready branch");
    // Form composer lives in GigiChat. Just assert the form/input exists in
    // the file — the branch containment above already proves it's gated.
    assert.match(source, /id=["']gigi-input["']/);
  });

  it("exposes a Settings link from the PageHeader action", () => {
    // The Settings icon link in the header is what makes Ustawienia
    // reachable even when the chat UI is gated. We assert it lives in a
    // `GigiSettingsAction` component AND that component is rendered in
    // the PageHeader `action` slot.
    assert.match(source, /function\s+GigiSettingsAction\s*\(/);
    assert.match(source, /to=["']\/settings["']/);
    assert.match(source, /action=\{<GigiSettingsAction\s*\/>\}/);
  });

  it("shows a loading spinner while the chatgpt-status query is in flight", () => {
    // The "loading" branch prevents the OAuth gate from flashing on
    // every navigation. Pin the literal so a future state-machine
    // rename still has a regression contract here.
    assert.match(source, /viewState\s*===\s*["']loading["']/);
  });
});
