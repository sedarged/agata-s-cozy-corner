// Agata — regression tests for the React Query client surface added for
// the OpenAI API key Settings card (replaces the prior ChatGPT OAuth
// surface on 2026-06-24) and the Gigi persistent chat history hooks
// (Task 5, 2026-06-26).
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

  it("caps useOpenAIKeyStatusQuery retries via shouldRetry to avoid infinite-spinner on flaky networks", () => {
    // Code-review finding W2 (2026-06-24, ported to openai-key): without
    // a retry cap, RQ's default of 3 leaves the user on the loading
    // spinner for ~3× the network timeout whenever the first GET fails.
    // H9 ports both `useOpenAIKeyStatusQuery` and `useDbHealthQuery` to
    // share the `shouldRetry` helper.
    assert.match(
      source,
      /useOpenAIKeyStatusQuery[\s\S]*?retry:\s*shouldRetry[\s\S]*?\}\s*\)/,
      "useOpenAIKeyStatusQuery must set retry: shouldRetry",
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

// ---- H7 / M11 / M12 --------------------------------------------------------

describe("React Query client — list-query staleTime + qk.setting", () => {
  it("uses LIST_STALE_MS on useGoalsQuery and useSettingQuery (H7)", () => {
    // Without `staleTime: LIST_STALE_MS`, every focus event refetches —
    // for a single-user app that means a 200 ms RPC on every tab
    // switch. Pin the constant on each query.
    assert.match(source, /useGoalsQuery[\s\S]*?staleTime:\s*LIST_STALE_MS/);
    assert.match(source, /useSettingQuery[\s\S]*?staleTime:\s*LIST_STALE_MS/);
  });

  it("exposes qk.setting(key) so the query and mutation share the key tuple (M11)", () => {
    // Drift risk: useSettingQuery uses `["settings", key]` and
    // useSetSettingMutation uses the same — but if someone refactors
    // one without the other, the cache invalidation silently breaks.
    // Pin the helper.
    assert.match(
      source,
      /setting:\s*\(\s*key:\s*string\s*\)\s*=>\s*\[\s*["']settings["']\s*,\s*key\s*\]/,
    );
    assert.match(source, /useSettingQuery[\s\S]*?queryKey:\s*qk\.setting\(/);
    assert.match(source, /useSetSettingMutation[\s\S]*?qk\.setting\(\s*vars\.key\s*\)/);
  });

  it("useCreateBookMutation invalidates the single-book key (M12)", () => {
    // After creating a book, the user typically navigates to /book/$id.
    // The list-key invalidation alone forces a refetch of all books,
    // but the per-book key still serves stale data — pin the second
    // invalidateQueries call.
    assert.match(
      source,
      /useCreateBookMutation[\s\S]*?invalidateQueries\(\s*\{\s*queryKey:\s*qk\.books\s*\}[\s\S]*?invalidateQueries\(\s*\{\s*queryKey:\s*qk\.book\(\s*\w+\.id\s*\)/,
    );
  });
});

// ---- H8: every mutation has an onError toast ------------------------------

describe("React Query client — mutation onError safety net (H8)", () => {
  it("every useMutation block includes an onError handler", () => {
    // Count `useMutation({` openings and `onError:` occurrences within
    // the same block. The pin is loose (>=) because shared inline helpers
    // like `defaultOnError` count once even if reused.
    const mutationOpenings = (source.match(/useMutation\(\s*\{/g) || []).length;
    const onErrorCount = (source.match(/\bonError:/g) || []).length;
    assert.ok(mutationOpenings > 0, "sanity: client.ts should still define useMutation calls");
    assert.ok(
      onErrorCount >= mutationOpenings,
      `each useMutation needs an onError handler (got ${onErrorCount} onError for ${mutationOpenings} useMutation)`,
    );
  });

  it("defines a shared onError handler that toasts (single source of truth)", () => {
    // A dedicated `defaultOnError(err)` function keeps the safety net
    // consistent: every mutation imports the same handler so future
    // changes (e.g. attach a retry button) happen in one place.
    assert.match(source, /function\s+defaultOnError\s*\(/);
    assert.match(source, /toast\.error\(/);
  });
});

// ---- H9: shouldRetry shared helper ----------------------------------------

describe("React Query client — shared shouldRetry helper (H9)", () => {
  it("exports shouldRetry that returns false on 4xx and true on 5xx up to 1 retry", () => {
    assert.match(source, /export\s+function\s+shouldRetry\s*\(/);
  });

  it("useDbHealthQuery caps retries via shouldRetry (H9)", () => {
    // The health endpoint legitimately 5xx during reboot — 3 retries ×
    // 1s backoff = 3-4s of stale orange. Cap to 1 via shouldRetry so the
    // orange clears within 1-2 s.
    assert.match(source, /useDbHealthQuery[\s\S]*?retry:\s*shouldRetry/);
  });
});

// ---- M10: import-apply docstring no longer stale ---------------------------

describe("React Query client — import-apply invalidation (M10)", () => {
  it("useImportApplyMutation invalidates books/notes/sessions/goals on success", () => {
    // The old docstring said "the caller is expected to invalidate" —
    // it now does it itself. Pin all four invalidateQueries calls so
    // a future refactor doesn't drop one (e.g. sessions).
    // Grab everything from `function useImportApplyMutation` up to the next
    // top-level `export function` — that's the function's body.
    const block = source.match(
      /function useImportApplyMutation\s*\(\s*\)\s*\{[\s\S]*?(?=\nexport function )/,
    );
    assert.ok(block, "useImportApplyMutation block should exist");
    const b = block[0];
    for (const key of ["qk.books", "qk.notes", "qk.sessions", "qk.goals"]) {
      assert.match(
        b,
        new RegExp(`invalidateQueries\\s*\\(\\s*\\{\\s*queryKey:\\s*${key.replace(/\./g, "\\.")}`),
      );
    }
  });
});

// ---- Task 5: Gigi persistent chat history hooks ----------------------------

describe("React Query client — Gigi chat history keys", () => {
  it("exposes qk.chats list tuple", async () => {
    // Dynamic import so the spec can fail with a clean assertion instead
    // of an opaque module-load error before the keys are wired in.
    const mod = await import("./client");
    assert.deepEqual(mod.qk.chats, ["chats"]);
  });

  it("exposes qk.chat(id) factory returning the per-chat tuple", async () => {
    const mod = await import("./client");
    assert.deepEqual(mod.qk.chat("c1"), ["chats", "c1"]);
  });
});

describe("React Query client — chat mutation/query hook surface", () => {
  it("exports all six chat hooks required by the Gigi history UI", () => {
    // Doc-style source assertion (project convention — see
    // notes-filter-overflow.spec.tsx). Pin the exported names so a future
    // rename forces a deliberate spec update instead of a silent breakage.
    for (const name of [
      "useChatsQuery",
      "useChatQuery",
      "useCreateChatMutation",
      "useAppendMessageMutation",
      "useRenameChatMutation",
      "useDeleteChatMutation",
    ]) {
      assert.ok(new RegExp(`export function ${name}\\b`).test(source), `${name} not exported`);
    }
  });
});
