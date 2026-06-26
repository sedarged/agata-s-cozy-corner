// ChatPanel.spec.ts — TDD contract for src/components/ChatPanel.tsx.
//
// Task 7 in the Gigi persistent conversations plan: extract the chat
// surface from the inline `GigiChat` function in src/routes/gigi.tsx into
// a reusable component that reads its conversation from the server via
// `useChatQuery(chatId)` and persists assistant messages via
// `useAppendMessageMutation`. The route will eventually pass an
// `activeChatId` from the sidebar (Task 8/9); for Task 7 the route keeps
// `chatId={null}` so the panel falls back to the in-memory WELCOME state.
//
// We follow the project convention (see notes-filter-overflow.spec.tsx,
// gigi.spec.ts) and pin the contract via regex assertions on the source
// rather than rendering under JSDOM — the panel wires up to React Query
// and a streaming fetch, so a real render test would need a lot of stub
// scaffolding that's not worth the maintenance burden here.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const source = readFileSync(resolve(here, "ChatPanel.tsx"), "utf8");

test("ChatPanel accepts a chatId prop typed string | null", () => {
  // Task 8 wires `activeChatId` from the sidebar; Task 7 passes `null`
  // from the route. The type must allow both so the same component can
  // render an empty new-chat state and a hydrated conversation.
  assert.match(source, /chatId:\s*string\s*\|\s*null/);
});

test("ChatPanel consumes useChatQuery to load messages", () => {
  // `useChatQuery(chatId)` is the React Query hook from src/lib/api/client.ts
  // that backs `getChat` server fn. When `chatId` is null the hook is
  // disabled, so the panel falls back to the in-memory WELCOME message.
  assert.match(source, /useChatQuery/);
});

test("ChatPanel consumes useAppendMessageMutation to persist assistant replies", () => {
  // The streaming `/api/chat` response writes the assistant message
  // server-side fire-and-forget, but we still call the mutation on the
  // client to invalidate the `qk.chat(id)` cache and re-render the list
  // with the freshly persisted message immediately.
  assert.match(source, /useAppendMessageMutation/);
});

test("ChatPanel keeps the abortRef pattern (C1)", () => {
  // Documented in CLAUDE.md: the panel must cancel the in-flight fetch
  // on unmount + on a new send, otherwise the reader loop keeps calling
  // setState on a dead component and React warns. The abortRef may be
  // expressed as `AbortController` or via the existing `abortRef`
  // identifier.
  assert.match(source, /AbortController|abortRef/);
});

test("ChatPanel swallows AbortError on stream cancel", () => {
  // Documented in CLAUDE.md: when the user navigates away or sends a new
  // message mid-stream, the fetch rejects with AbortError. We must NOT
  // surface that as a "Brak połączenia z Gigi" error — it's expected.
  assert.match(source, /AbortError|name === ['"]AbortError['"]/);
});
