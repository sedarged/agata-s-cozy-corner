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

test("ChatPanel does NOT call appendMessage.mutate to persist assistant replies (regression)", () => {
  // Regression (2026-06-26, browser smoke): the streaming /api/chat route
  // ALREADY persists the assistant message server-side via
  // `void result.text.then(...)` in src/routes/api/chat.ts. If the client
  // also calls `useAppendMessageMutation` after the stream, the server
  // inserts a SECOND row with a fresh UUID → users saw 2 identical
  // assistant bubbles after one send. The client must invalidate the
  // React Query cache (so other tabs / refetches see the persisted row)
  // but MUST NOT call appendMessage.mutate() — that's a duplicate write.
  assert.match(source, /useAppendMessageMutation/, "hook import kept for future use, but…");
  // The post-stream call site must NOT call .mutate on the returned mutation.
  // We pin the literal `appendMessage.mutate(` is absent — only the hook
  // declaration `useAppendMessageMutation` is allowed.
  const afterStreamBlock = source.match(/result\.text|stream complete|onSuccess/i)
    ? source
    : source;
  assert.doesNotMatch(
    afterStreamBlock,
    /appendMessage\.mutate\(/,
    "ChatPanel must NOT call appendMessage.mutate after stream — /api/chat already persists server-side. Duplicate writes produce 2 identical bubbles in DB.",
  );
});

test("ChatPanel invalidates qk.chat + qk.chats after a successful stream via useQueryClient", () => {
  // After the stream completes, the server has persisted the assistant
  // row. The client must invalidate the React Query caches so any
  // concurrent observer (e.g. the sidebar list, a future book-detail
  // page showing chat history) refetches the persisted state. The pin
  // accepts either the import name `useQueryClient` or the destructured
  // `qc` shorthand — both are common project idioms.
  assert.match(
    source,
    /useQueryClient|qc\.invalidateQueries/,
    "ChatPanel must invalidate React Query caches after stream completes",
  );
  assert.match(
    source,
    /qk\.chat\s*\(\s*chatId\s*\)|invalidateQueries\s*\(\s*\{\s*queryKey:\s*qk\.chat/,
    "invalidation must target qk.chat(chatId) so the panel re-reads persisted messages",
  );
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

test("ChatPanel auto-renames a chat after the first user message", () => {
  // Task 10 — when a new chat's first user message persists and the
  // server-side session.title is still null, the panel derives a 60-char
  // single-line title from the user message and calls useRenameChatMutation.
  // The mutation's onSuccess optimistically patches session.title so the
  // guard `session.title == null` short-circuits duplicate calls.
  assert.match(source, /useRenameChatMutation/);
  assert.match(source, /\.slice\(0,\s*60\)|titleFromMessage|deriveTitle/);
});
