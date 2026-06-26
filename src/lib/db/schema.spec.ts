// Pin: chatSessions + chatMessages table definitions exist and have the
// columns downstream code relies on. Schema is checked at runtime; the
// indexes are pinned via the generated drizzle migration SQL (see
// drizzle/0001_chats.sql) and asserted separately in chat-migration.spec.ts.
import { test } from "node:test";
import assert from "node:assert/strict";
import { chatSessions, chatMessages } from "./schema";

test("chatSessions has the expected columns (id, title, createdAt, updatedAt)", () => {
  const cols = Object.keys(chatSessions);
  for (const expected of ["id", "title", "createdAt", "updatedAt"]) {
    assert.ok(cols.includes(expected), `missing column ${expected}`);
  }
});

test("chatMessages has the expected columns (id, chatId, role, content, createdAt)", () => {
  const cols = Object.keys(chatMessages);
  for (const expected of ["id", "chatId", "role", "content", "createdAt"]) {
    assert.ok(cols.includes(expected), `missing column ${expected}`);
  }
});