// Agata — regression tests for the React Query client surface added for
// the OpenAI API key Settings card (replaces the prior ChatGPT OAuth
// surface on 2026-06-24).
//
// The Settings card (`OpenAIKeyCard.tsx`) must reflect the openai-key
// status query result without getting stuck on a spinner after a
// transient network blip, AND must pick up changes after the user
// saves / deletes the key in the card without waiting for `staleTime`
// to elapse.
//
// Both properties are pinned by string-contract assertions on the
// source (the project convention — see notes-filter-overflow.spec.tsx)
// so a refactor can't silently remove the retry cap or drop the
// invalidation helper. We assert on `client.ts` directly; the React
// Query wiring itself is covered by integration tests above.

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const source = readFileSync(resolve(here, "client.ts"), "utf8");

describe("React Query client — openai-key status surface", () => {
  it("exposes qk.openaiKeyStatus with the canonical key tuple", () => {
    // The query key MUST stay `["openai-key", "status"]` so existing
    // cache entries from before this commit still resolve to the same
    // row in the React Query cache. Changing it silently would orphan
    // every cached status on next deploy.
    assert.match(
      source,
      /openaiKeyStatus:\s*\[\s*["']openai-key["']\s*,\s*["']status["']\s*\]\s*as const/,
    );
  });

  it("caps useOpenAIKeyStatusQuery retries at 1 to avoid infinite-spinner on flaky networks", () => {
    // Code-review finding W2 (2026-06-24, ported to openai-key): without
    // `retry: 1`, RQ's default of 3 leaves the user on the loading
    // spinner for ~3× the network timeout whenever the first GET fails.
    // Pin the literal so a future refactor doesn't drop the cap.
    assert.match(
      source,
      /useOpenAIKeyStatusQuery[\s\S]*?retry:\s*1[\s\S]*?\}\s*\)/,
      "useOpenAIKeyStatusQuery must set retry: 1",
    );
  });

  it("exports invalidateOpenAIKeyStatus so the Settings card can force a refetch", () => {
    // After a successful save / delete, the banner on /gigi and the
    // Settings card itself must pick up the new state on next
    // navigation, even within the 10s staleTime window. The fix is
    // for the card to invalidate the query after a successful mutation
    // so the next consumer refetches.
    assert.match(source, /export function invalidateOpenAIKeyStatus/);
    assert.match(source, /invalidateQueries\(\s*\{\s*queryKey:\s*qk\.openaiKeyStatus/);
  });

  it("invalidateOpenAIKeyStatus signature accepts the QueryClient", () => {
    // The helper takes whatever `useQueryClient()` returns so the
    // caller doesn't have to thread a custom type through.
    assert.match(
      source,
      /function invalidateOpenAIKeyStatus\(\s*qc:\s*ReturnType<\s*typeof useQueryClient\s*>/,
    );
  });
});
