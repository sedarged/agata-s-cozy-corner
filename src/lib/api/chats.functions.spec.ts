// Agata — Zod input contract tests for the Gigi chat persistence server
// functions. These are the load-bearing checks: any future tweak to the
// schemas must keep these invariants (id length cap, non-empty content,
// non-empty title) or downstream Zod-validation will silently allow
// payload abuse against the SQLite repo.
import { test } from "node:test";
import assert from "node:assert/strict";
import { CreateChatInputSchema, AppendMessageInputSchema, RenameChatInputSchema } from "./schemas";

test("CreateChatInputSchema rejects ids longer than 128 chars", () => {
  const r = CreateChatInputSchema.safeParse({ id: "x".repeat(129) });
  assert.equal(r.success, false);
});

test("AppendMessageInputSchema rejects empty content", () => {
  const r = AppendMessageInputSchema.safeParse({
    chatId: "c1",
    role: "user",
    content: "",
  });
  assert.equal(r.success, false);
});

test("RenameChatInputSchema requires non-empty title", () => {
  const r = RenameChatInputSchema.safeParse({ chatId: "c1", title: "" });
  assert.equal(r.success, false);
});
