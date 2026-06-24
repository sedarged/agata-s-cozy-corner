// Agata — regression test pinning the `gigi.oauth` cookie construction in
// the OAuth login route.
//
// 2026-06-24 bug: `src/routes/api/chatgpt/login.ts` was passing
//   value: encodeURIComponent(JSON.stringify({ state, verifier }))
// to `serializeSetCookie`. `serializeSetCookie` already calls
// `encodeURIComponent` on its input, so the value ended up doubly-encoded.
// The browser stored it verbatim, `parseCookieHeader` decoded once on the
// way back, and `JSON.parse` in `/api/chatgpt/callback` threw on the still-
// encoded string → the callback redirected to
//   /settings?chatgpt=error&reason=expired
// even after a successful OAuth consent.
//
// Contract (enforced by `src/lib/http/cookies.ts`): callers pass RAW
// values; `serializeSetCookie` handles the single encoding. This spec
// pins that contract on `login.ts` so a future refactor can't reintroduce
// the double-encoding pattern.

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const source = readFileSync(resolve(here, "login.ts"), "utf8");

describe("/api/chatgpt/login — cookie value must be raw JSON, not pre-encoded", () => {
  it("does not double-encode the JSON payload via encodeURIComponent(JSON.stringify(...))", () => {
    // The anti-pattern that caused the 2026-06-24 callback regression:
    // wrapping JSON.stringify in encodeURIComponent AND letting
    // serializeSetCookie encode again. The contract is single-encoding.
    assert.doesNotMatch(
      source,
      /encodeURIComponent\(\s*JSON\.stringify/,
      "login.ts must pass the raw JSON.stringify(...) to serializeSetCookie; " +
        "serializeSetCookie already URL-encodes once.",
    );
  });

  it("still calls serializeSetCookie with a JSON.stringify payload (sanity)", () => {
    // Defensive: if a future refactor drops the cookie entirely (e.g. moves
    // state into a server store) this test starts failing and the contract
    // is re-evaluated — we don't silently lose the regression guard.
    assert.match(source, /serializeSetCookie\(\s*\{[\s\S]*?value:\s*JSON\.stringify/);
  });
});
