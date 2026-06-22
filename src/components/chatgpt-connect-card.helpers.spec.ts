// Agata — tests for `chatgpt-connect-card.helpers.ts`.
//
// History: these used to live inline in `ChatGPTConnectCard.tsx` and could
// only be verified end-to-end through Playwright. Splitting them out lets
// node:test cover them — matching the rest of the codebase's test
// conventions (see package.json `npm test`).
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { formatExpiry, parsePaste, pickUrlCleanup } from "./chatgpt-connect-card.helpers";

describe("parsePaste", () => {
  it("returns null on empty input", () => {
    assert.equal(parsePaste(""), null);
    assert.equal(parsePaste("   "), null);
  });

  it("parses a full callback URL", () => {
    const out = parsePaste("http://127.0.0.1:3001/api/chatgpt/callback?code=abc&state=xyz");
    assert.deepEqual(out, { code: "abc", state: "xyz" });
  });

  it("parses a URL even when query has extra params", () => {
    const out = parsePaste("https://example.com/cb?code=AAA&state=BBB&other=junk");
    assert.deepEqual(out, { code: "AAA", state: "BBB" });
  });

  it("falls back to `code=... state=...` on two lines", () => {
    const out = parsePaste("code=abc\nstate=xyz");
    assert.deepEqual(out, { code: "abc", state: "xyz" });
  });

  it("falls back to `code=... state=...` separated by whitespace", () => {
    const out = parsePaste("code=abc   state=xyz");
    assert.deepEqual(out, { code: "abc", state: "xyz" });
  });

  it("returns null when only one of code/state is present", () => {
    assert.equal(parsePaste("code=abc"), null);
    assert.equal(parsePaste("state=xyz"), null);
  });

  it("returns null for completely unrelated text", () => {
    assert.equal(parsePaste("hello world"), null);
  });
});

describe("formatExpiry", () => {
  it("returns em-dash for missing expiry", () => {
    assert.equal(formatExpiry(undefined), "—");
    assert.equal(formatExpiry(0), "—");
  });

  it("returns `wygasł` for past expiry", () => {
    const now = 1_700_000_000_000;
    assert.equal(formatExpiry(now - 1000, now), "wygasł");
  });

  it("formats sub-hour expiry in minutes", () => {
    const now = 1_700_000_000_000;
    const exp = now + 25 * 60_000; // 25 min
    assert.equal(formatExpiry(exp, now), "wygasa za 25 min");
  });

  it("formats hour+ expiry in hours", () => {
    const now = 1_700_000_000_000;
    const exp = now + 3 * 60 * 60_000; // 3 h
    assert.equal(formatExpiry(exp, now), "wygasa za 3 godz.");
  });
});

describe("pickUrlCleanup", () => {
  it("returns null when no chatgpt flag is present", () => {
    assert.equal(pickUrlCleanup("https://example.com/settings"), null);
    assert.equal(pickUrlCleanup("https://example.com/settings?other=x"), null);
  });

  it("strips `chatgpt`, `account`, `reason`, `msg` from the URL", () => {
    const out = pickUrlCleanup(
      "https://example.com/settings?chatgpt=connected&account=acc123&reason=ok&msg=hi&keep=yes",
    );
    assert.ok(out);
    const u = new URL(out!);
    assert.equal(u.searchParams.get("chatgpt"), null);
    assert.equal(u.searchParams.get("account"), null);
    assert.equal(u.searchParams.get("reason"), null);
    assert.equal(u.searchParams.get("msg"), null);
    assert.equal(u.searchParams.get("keep"), "yes");
    assert.equal(u.pathname, "/settings");
  });

  it("returns null for error flag too (we still clean the URL)", () => {
    const out = pickUrlCleanup("https://example.com/settings?chatgpt=error&reason=denied");
    assert.ok(out);
    const u = new URL(out!);
    assert.equal(u.searchParams.get("chatgpt"), null);
    assert.equal(u.searchParams.get("reason"), null);
  });

  it("preserves the protocol, host, path, and fragment", () => {
    const out = pickUrlCleanup("https://example.com:9443/settings?chatgpt=connecting#section");
    assert.ok(out);
    assert.ok(out!.startsWith("https://example.com:9443/settings"));
    assert.ok(out!.endsWith("#section"));
  });
});
