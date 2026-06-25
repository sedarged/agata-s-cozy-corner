// Agata — regression tests for the /gigi page.
//
// User requirement (2026-06-24):
//   1. Settings must be reachable on /gigi at all times (not hidden behind
//      a chat UI that the user can't even interact with).
//
// After the OpenAI API key redesign (2026-06-25), the OAuth-first landing
// is replaced by an inline banner: the chat composer stays visible, and
// the user is pointed to Settings when no key is configured. We pin:
//   - The page reads the openai-key status (not the dropped chatgpt status).
//   - The banner renders only when `configured === false`.
//   - The chat composer is NOT gated by view-state branches anymore.
//   - The Settings action stays in the PageHeader.
//
// Project convention (see notes-filter-overflow.spec.tsx) is to test via
// string-contract assertions on the source rather than render with JSDOM.
// We follow that convention here.

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const source = readFileSync(resolve(here, "gigi.tsx"), "utf8");

describe("/gigi page — OpenAI key banner", () => {
  it("reads the openai-key status hook from the React Query client", () => {
    assert.match(source, /useOpenAIKeyStatusQuery/);
    // The dropped chatgpt status hook must NOT be referenced anymore.
    assert.doesNotMatch(source, /useChatgptStatusQuery/);
  });

  it("renders GigiNoKeyBanner when configured: false", () => {
    // Pin the literal `configured === false` so the conditional stays in
    // sync with the OpenAIKeyStatus contract from src/lib/api/client.ts.
    assert.match(
      source,
      /showNoKeyBanner\s*=\s*openaiKeyQuery\.data\?\.configured\s*===\s*false/,
      "banner must be driven by `configured === false`",
    );
    assert.match(
      source,
      /showNoKeyBanner\s*&&\s*<GigiNoKeyBanner\b/,
      "GigiNoKeyBanner must be rendered conditionally on showNoKeyBanner",
    );
  });

  it("defines GigiNoKeyBanner with a link to /settings", () => {
    const banner = source.match(/function\s+GigiNoKeyBanner\s*\(\s*\)\s*\{([\s\S]*?)\n\}/);
    assert.ok(banner, "GigiNoKeyBanner function must exist");
    assert.match(banner![1], /to=["']\/settings["']/, "banner must link to /settings");
    assert.match(
      banner![1],
      /Ustaw go w Ustawieniach/,
      "banner copy must point the user at Settings",
    );
  });

  it("does NOT gate the chat composer behind any OAuth-first view-state branch", () => {
    // The dropped machine had three states ("loading" / "needs-oauth" /
    // "ready"). Make sure none of them survives in the source — otherwise
    // the chat could disappear again on slow networks or transient errors.
    assert.doesNotMatch(source, /getGigiViewState/);
    assert.doesNotMatch(source, /viewState\s*===\s*["']needs-oauth["']/);
    assert.doesNotMatch(source, /viewState\s*===\s*["']ready["']/);
    assert.doesNotMatch(source, /viewState\s*===\s*["']loading["']/);
  });

  it("renders <GigiChat> unconditionally (banner is non-blocking)", () => {
    // The composer is the <form> with id "gigi-input" + the prompt
    // chips. We assert GigiChat is rendered inside Gigi (not gated by
    // any branch) so users can always type — the send will surface the
    // notConfiguredMessage via the existing 503 error path.
    assert.match(source, /<GigiChat\b/);
  });

  it("exposes a Settings link from the PageHeader action", () => {
    // The Settings icon link in the header is what makes Ustawienia
    // reachable even when no key is configured. We assert it lives in a
    // `GigiSettingsAction` component AND that component is rendered in
    // the PageHeader `action` slot.
    assert.match(source, /function\s+GigiSettingsAction\s*\(/);
    assert.match(source, /to=["']\/settings["']/);
    assert.match(source, /action=\{<GigiSettingsAction\s*\/>\}/);
  });
});
