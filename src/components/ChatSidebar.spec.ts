// Doc-style regression tests for ChatSidebar.
// These pin the public contract: which React Query hooks the component
// consumes, that it exposes a "Nowa rozmowa" CTA, that it offers per-row
// delete via a useFocusTrap-driven custom confirm modal (NOT Radix
// AlertDialog — that package's transitive deps crash rolldown 1.1.2), that
// it offers per-row rename, and that it accepts onSelect + onNewChat
// callback props from its parent.
//
// Match the brief's pseudocode closely; only deviate if a project's
// existing convention requires it.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const source = readFileSync(resolve(here, "ChatSidebar.tsx"), "utf8");

test("ChatSidebar consumes useChatsQuery", () => {
  assert.match(source, /useChatsQuery/);
});

test("ChatSidebar exposes a 'Nowa rozmowa' (new chat) button", () => {
  assert.match(source, /Nowa rozmowa|onNewChat/);
});

test("ChatSidebar delete-confirm uses useFocusTrap (custom modal, no Radix AlertDialog)", () => {
  assert.match(source, /useFocusTrap/);
  assert.doesNotMatch(source, /@radix-ui\/react-alert-dialog/);
  assert.doesNotMatch(source, /from\s+["']@\/components\/ui\/alert-dialog["']/);
  assert.match(source, /useDeleteChatMutation/);
});

test("ChatSidebar exposes per-row rename", () => {
  assert.match(source, /useRenameChatMutation|rename/i);
});

test("ChatSidebar accepts onSelect + onNewChat callbacks", () => {
  // Doc pin: the component must accept these two callbacks from the parent.
  assert.match(source, /onSelect\??:.*string\s*=>\s*void|onSelect\?\s*:\s*\(/);
  assert.match(source, /onNewChat\??:.*\(\)\s*=>\s*void|onNewChat\?\s*:\s*\(/);
});
