// chat-merge.spec.ts — TDD unit tests for src/components/chat-merge.ts.
//
// The mergeMessages helper deduplicates server-persisted messages against
// the local ChatPanel view-model by (role, content) — NOT by id. This is
// the B1 regression fix: optimistic bubble ids (`u-{uuid}` / `a-{uuid}`)
// never collide with server-side UUIDs, so id-based merging double-renders
// every persisted row.

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { mergeMessages, type ChatMsg } from "./chat-merge";

describe("mergeMessages — empty persisted", () => {
  it("returns local unchanged when persisted is empty", () => {
    const local: ChatMsg[] = [
      { id: "u-local-1", role: "user", content: "Cześć" },
      { id: "a-local-1", role: "assistant", content: "Cześć, Agato" },
    ];
    assert.deepEqual(mergeMessages(local, []), local);
  });
});

describe("mergeMessages — empty local", () => {
  it("returns the persisted list when local is empty", () => {
    const persisted: ChatMsg[] = [
      { id: "srv-1", role: "user", content: "Hej" },
      { id: "srv-2", role: "assistant", content: "Hej, Agato" },
    ];
    const out = mergeMessages<ChatMsg>([], persisted);
    assert.deepEqual(out, persisted);
  });
});

describe("mergeMessages — B1 regression (dedupe by role + content, NOT id)", () => {
  it("does NOT append a persisted row whose (role, content) already exists locally", () => {
    // The bug scenario: local has the optimistic bubble (`a-{uuid}`), the
    // server persisted the same content under a server UUID. They describe
    // the same turn. Merge must NOT append.
    const local: ChatMsg[] = [{ id: "a-opt-12345", role: "assistant", content: "Cześć, Agato 💛" }];
    const persisted: ChatMsg[] = [
      { id: "a-srv-67890", role: "assistant", content: "Cześć, Agato 💛" },
    ];
    const out = mergeMessages(local, persisted);
    assert.equal(out.length, 1, "merge must NOT double-render the assistant turn");
    assert.equal(out[0].id, "a-opt-12345", "optimistic id is preserved");
  });

  it("appends NEW persisted turns that don't exist locally yet", () => {
    // First reload after a server restart: persisted has the full history,
    // local is empty. All persisted rows are new → all appended.
    const persisted: ChatMsg[] = [
      { id: "srv-1", role: "user", content: "Hej" },
      { id: "srv-2", role: "assistant", content: "Hej, Agato" },
    ];
    const out = mergeMessages<ChatMsg>([], persisted);
    assert.equal(out.length, 2);
    assert.deepEqual(
      out.map((m) => m.id),
      ["srv-1", "srv-2"],
    );
  });

  it("appends only the rows that are genuinely new (mixed scenario)", () => {
    // Two server rows: the first duplicates the local optimistic bubble,
    // the second is a brand-new assistant turn. Merge should drop the
    // duplicate and keep the new one.
    const local: ChatMsg[] = [
      { id: "u-opt", role: "user", content: "Co czytasz?" },
      { id: "a-opt", role: "assistant", content: "Twoją bibliotekę." },
    ];
    const persisted: ChatMsg[] = [
      { id: "u-srv", role: "user", content: "Co czytasz?" },
      { id: "a-srv", role: "assistant", content: "Twoją bibliotekę." },
      { id: "a-srv2", role: "assistant", content: "Lubię «Lalkę»." },
    ];
    const out = mergeMessages(local, persisted);
    // 2 local + 1 new = 3. The two duplicates (u-opt/u-srv and
    // a-opt/a-srv) collapse to the local ones.
    assert.equal(out.length, 3);
    assert.deepEqual(
      out.map((m) => ({ id: m.id, role: m.role, content: m.content })),
      [
        { id: "u-opt", role: "user", content: "Co czytasz?" },
        { id: "a-opt", role: "assistant", content: "Twoją bibliotekę." },
        { id: "a-srv2", role: "assistant", content: "Lubię «Lalkę»." },
      ],
    );
  });

  it("preserves WELCOME in local when persisted is empty", () => {
    const local: ChatMsg[] = [{ id: "welcome", role: "assistant", content: "Cześć, tu Gigi." }];
    assert.deepEqual(mergeMessages(local, []), local);
  });

  it("does NOT append a persisted row whose id is the synthetic 'welcome' marker", () => {
    // Defensive: if the server ever persisted a row with id === "welcome"
    // (it shouldn't — client never sends that id), skip it to avoid
    // duplicating the WELCOME bubble.
    const local: ChatMsg[] = [{ id: "welcome", role: "assistant", content: "Cześć, tu Gigi." }];
    const persisted: ChatMsg[] = [{ id: "welcome", role: "assistant", content: "Cześć, tu Gigi." }];
    const out = mergeMessages(local, persisted);
    assert.equal(out.length, 1);
    assert.equal(out[0].id, "welcome");
  });

  it("distinguishes messages by role (same content, different role → both kept)", () => {
    // Edge case: user and assistant could theoretically produce the same
    // content string. Merge must NOT collapse them.
    const local: ChatMsg[] = [{ id: "u-opt", role: "user", content: "Ok." }];
    const persisted: ChatMsg[] = [
      { id: "u-srv", role: "user", content: "Ok." },
      { id: "a-srv", role: "assistant", content: "Ok." },
    ];
    const out = mergeMessages(local, persisted);
    // Local user "Ok." duplicates persisted user "Ok." → skipped.
    // Persisted assistant "Ok." is new → appended.
    assert.equal(out.length, 2);
    assert.equal(out[0].role, "user");
    assert.equal(out[1].role, "assistant");
  });

  it("preserves local order: local first, then new persisted rows in server order", () => {
    const local: ChatMsg[] = [
      { id: "a-opt-1", role: "assistant", content: "first" },
      { id: "a-opt-2", role: "assistant", content: "second" },
    ];
    const persisted: ChatMsg[] = [
      { id: "a-srv-2", role: "assistant", content: "second" }, // dup
      { id: "a-srv-3", role: "assistant", content: "third" }, // new
      { id: "a-srv-4", role: "assistant", content: "fourth" }, // new
    ];
    const out = mergeMessages(local, persisted);
    assert.deepEqual(
      out.map((m) => m.content),
      ["first", "second", "third", "fourth"],
    );
  });
});
