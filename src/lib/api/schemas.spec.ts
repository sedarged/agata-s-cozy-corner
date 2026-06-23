// schemas.spec.ts — regression tests for the per-field length caps
// added to src/lib/api/schemas.ts. A malicious (or just typo'd) payload
// like `tags: ["a".repeat(10 * 1024 * 1024)]` must not survive Zod and
// must not be persisted to SQLite.

import { z } from "zod";
import assert from "node:assert/strict";
import { test } from "node:test";
import {
  BookInputSchema,
  NoteInputSchema,
  SessionInputSchema,
  ChatMessageSchema,
  SettingPutSchema,
} from "./schemas";

test("BookInputSchema rejects an oversized title", () => {
  const r = BookInputSchema.safeParse({
    id: "b1",
    title: "x".repeat(3_000),
  });
  assert.equal(r.success, false);
});

test("BookInputSchema accepts a 2 KB title", () => {
  const r = BookInputSchema.safeParse({
    id: "b1",
    title: "x".repeat(2_000),
  });
  assert.equal(r.success, true);
});

test("BookInputSchema caps tag count at 64 and tag length at 64", () => {
  const r1 = BookInputSchema.safeParse({
    id: "b1",
    title: "ok",
    tags: Array.from({ length: 65 }, (_, i) => `t${i}`),
  });
  assert.equal(r1.success, false, "65 tags should be rejected");

  const r2 = BookInputSchema.safeParse({
    id: "b1",
    title: "ok",
    tags: ["x".repeat(65)],
  });
  assert.equal(r2.success, false, "65-char tag should be rejected");
});

test("NoteInputSchema rejects an oversized content", () => {
  const r = NoteInputSchema.safeParse({
    id: "n1",
    bookId: "b1",
    type: "note",
    content: "x".repeat(21_000),
  });
  assert.equal(r.success, false);
});

test("SessionInputSchema clamps minutes / pages to safe ranges", () => {
  const r = SessionInputSchema.safeParse({
    id: "s1",
    bookId: "b1",
    date: "2026-06-23",
    minutes: 86_400 + 1,
    pagesRead: 0,
    startPage: 0,
    endPage: 0,
  });
  assert.equal(r.success, false, "minutes > 1 day should be rejected");
});

// Mirrors the parse the route does at /api/chat — `z.array(ChatMessageSchema).max(50)`.
test("Chat message cap matches /api/chat: 50 entries, 32 000 chars each", () => {
  const parse = (msgs: unknown) => z.array(ChatMessageSchema).max(50).safeParse(msgs);

  const tooMany = Array.from({ length: 51 }, () => ({ role: "user", content: "hi" }));
  assert.equal(parse(tooMany).success, false, "51 messages should be rejected");

  const huge = [{ role: "user", content: "x".repeat(33_000) }];
  assert.equal(parse(huge).success, false, "33 000-char content should be rejected");

  assert.equal(parse([]).success, true, "the route handles 0-length itself");
});

test("SettingPutSchema caps key length to 128", () => {
  const r = SettingPutSchema.safeParse({ key: "k".repeat(200), value: 1 });
  assert.equal(r.success, false);
});
