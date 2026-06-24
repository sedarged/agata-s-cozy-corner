// Agata — regression tests for the React Query client surface added for
// the OAuth-first Gigi landing (commit on 2026-06-24).
//
// User requirement: on /gigi, the page must reflect the chatgpt-status
// query result without getting stuck on a spinner after a transient
// network blip, AND must pick up changes after the user connects/disconnects
// from the Settings card without waiting for `staleTime` to elapse.
//
// Both properties are pinned by string-contract assertions on the source
// (the project convention — see notes-filter-overflow.spec.tsx) so a
// refactor can't silently remove the retry cap or drop the invalidation
// helper. We assert on `client.ts` directly; the React Query wiring
// itself is covered by integration tests above.

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const source = readFileSync(resolve(here, "client.ts"), "utf8");

describe("React Query client — chatgpt status surface", () => {
  it("exposes qk.chatgptStatus with the canonical key tuple", () => {
    // The query key MUST stay `["chatgpt", "status"]` so existing
    // cache entries from before this commit still resolve to the same
    // row in the React Query cache. Changing it silently would orphan
    // every cached status on next deploy.
    assert.match(
      source,
      /chatgptStatus:\s*\[\s*["']chatgpt["']\s*,\s*["']status["']\s*\]\s*as const/,
    );
  });

  it("caps useChatgptStatusQuery retries at 1 to avoid infinite-spinner on flaky networks", () => {
    // Code-review finding W2 (2026-06-24): without `retry: 1`, RQ's default
    // of 3 leaves the user on the loading spinner for ~3× the network
    // timeout whenever the first GET fails. Pin the literal so a future
    // refactor doesn't drop the cap.
    assert.match(
      source,
      /useChatgptStatusQuery[\s\S]*?retry:\s*1[\s\S]*?\}\s*\)/,
      "useChatgptStatusQuery must set retry: 1",
    );
  });

  it("exports invalidateChatgptStatus so ChatGPTConnectCard can force a refetch", () => {
    // Code-review finding W3 (2026-06-24): after a successful connect,
    // navigating to /gigi within the 10s staleTime window would still
    // show the OAuth gate. The fix is for the card to invalidate the
    // query after a successful refresh() so the next consumer refetches.
    assert.match(source, /export function invalidateChatgptStatus/);
    assert.match(source, /invalidateQueries\(\s*\{\s*queryKey:\s*qk\.chatgptStatus/);
  });

  it("invalidateChatgptStatus signature accepts the QueryClient", () => {
    // The helper takes whatever `useQueryClient()` returns so the
    // caller doesn't have to thread a custom type through.
    assert.match(
      source,
      /function invalidateChatgptStatus\(\s*qc:\s*ReturnType<\s*typeof useQueryClient\s*>/,
    );
  });
});
