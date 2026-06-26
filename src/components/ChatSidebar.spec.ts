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

test("ChatSidebar row icon buttons (rename + delete) have focus-visible rings (B3 a11y)", () => {
  // Validator (2026-06-26): the per-row Pencil + Trash icon buttons
  // (one in source each — rendered via .map) had no focus-visible
  // styles → keyboard users tabbing through the chat list had no
  // visible focus indicator on the row controls (WCAG 2.4.7). The
  // project's button.tsx baseline (`focus-visible:ring-1
  // focus-visible:ring-ring`) is the convention — pin that both
  // aria-labelled buttons carry at least `focus-visible:ring`. Use
  // [\s\S]*? (non-greedy) for the opening-tag span so the regex
  // doesn't consume `aria-label=...` as part of the `[^>]*` match.
  const renameBlock = source.match(
    /<button[\s\S]*?aria-label=["']Zmień nazwę["'][\s\S]*?<\/button>/,
  );
  assert.ok(renameBlock, "ChatSidebar rename button (aria-label='Zmień nazwę') must exist");
  assert.match(
    renameBlock[0],
    /focus-visible:ring/,
    "ChatSidebar rename button must have a focus-visible ring (WCAG 2.4.7)",
  );
  const deleteBlock = source.match(
    /<button[\s\S]*?aria-label=["']Usuń rozmowę["'][\s\S]*?<\/button>/,
  );
  assert.ok(deleteBlock, "ChatSidebar delete button (aria-label='Usuń rozmowę') must exist");
  assert.match(
    deleteBlock[0],
    /focus-visible:ring/,
    "ChatSidebar delete button must have a focus-visible ring (WCAG 2.4.7)",
  );
});
