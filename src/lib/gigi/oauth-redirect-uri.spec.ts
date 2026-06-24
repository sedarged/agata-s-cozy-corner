// Agata — tests for the OAuth redirect-uri resolver.
//
// All three ChatGPT OAuth routes (`login`, `callback`, `exchange`) read the
// `redirect_uri` they send to / receive from OpenAI's auth server. The
// resolver lives in `src/lib/gigi/oauth-redirect-uri.ts` and is the
// single source of truth so the three routes can't drift apart.
//
// We test:
//   - explicit env var wins
//   - default is the loopback URL (so paste-the-URL flow keeps working
//     for local dev / VPS-direct access without a tunnel)
//   - whitespace-only env var falls back to default (don't send
//     `redirect_uri=   ` to OpenAI — that's a real failure mode)
//   - default port is read from `process.env.PORT` (Agata binds PORT=3002
//     on the VPS; a hard-coded 3001 would point OpenAI at a port nothing
//     is listening on → connection refused → "callback failed")

import { afterEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import { resolveChatGptRedirectUri } from "./oauth-redirect-uri";

const ORIGINAL_URI = process.env.CHATGPT_OAUTH_REDIRECT_URI;
const ORIGINAL_PORT = process.env.PORT;

afterEach(() => {
  if (ORIGINAL_URI === undefined) delete process.env.CHATGPT_OAUTH_REDIRECT_URI;
  else process.env.CHATGPT_OAUTH_REDIRECT_URI = ORIGINAL_URI;
  if (ORIGINAL_PORT === undefined) delete process.env.PORT;
  else process.env.PORT = ORIGINAL_PORT;
});

describe("resolveChatGptRedirectUri", () => {
  it("returns the explicit env value when set", () => {
    process.env.CHATGPT_OAUTH_REDIRECT_URI = "https://mycozylibary.com/api/chatgpt/callback";
    delete process.env.PORT;
    assert.equal(resolveChatGptRedirectUri(), "https://mycozylibary.com/api/chatgpt/callback");
  });

  it("falls back to PORT-derived loopback URL when the env var is unset", () => {
    delete process.env.CHATGPT_OAUTH_REDIRECT_URI;
    delete process.env.PORT;
    // 2026-06-24 fix: the loopback default must match the port Agata is
    // actually bound to. On the VPS that's 3002 (see memory
    // `agata-port-and-tunnel-mode.md`). A hard-coded 3001 here would
    // send OpenAI back to a port nothing listens on.
    assert.equal(resolveChatGptRedirectUri(), "http://127.0.0.1:3002/api/chatgpt/callback");
  });

  it("uses the live PORT env var (3002) when set", () => {
    delete process.env.CHATGPT_OAUTH_REDIRECT_URI;
    process.env.PORT = "3002";
    assert.equal(resolveChatGptRedirectUri(), "http://127.0.0.1:3002/api/chatgpt/callback");
  });

  it("uses the live PORT env var (3001) when set — back-compat for old VPS configs", () => {
    delete process.env.CHATGPT_OAUTH_REDIRECT_URI;
    process.env.PORT = "3001";
    assert.equal(resolveChatGptRedirectUri(), "http://127.0.0.1:3001/api/chatgpt/callback");
  });

  it("falls back to the loopback URL when the env var is whitespace-only", () => {
    process.env.CHATGPT_OAUTH_REDIRECT_URI = "   ";
    delete process.env.PORT;
    assert.equal(resolveChatGptRedirectUri(), "http://127.0.0.1:3002/api/chatgpt/callback");
  });

  it("trims a useful env value", () => {
    process.env.CHATGPT_OAUTH_REDIRECT_URI = "  https://mycozylibary.com/api/chatgpt/callback  ";
    assert.equal(resolveChatGptRedirectUri(), "https://mycozylibary.com/api/chatgpt/callback");
  });

  it("falls back to default when env value contains CRLF (header-injection guard)", () => {
    process.env.CHATGPT_OAUTH_REDIRECT_URI = "https://mycozylibary.com\r\nSet-Cookie: x=y";
    delete process.env.PORT;
    assert.equal(resolveChatGptRedirectUri(), "http://127.0.0.1:3002/api/chatgpt/callback");
  });

  it("falls back to default when env value is not an http(s) URL", () => {
    process.env.CHATGPT_OAUTH_REDIRECT_URI = "javascript:alert(1)";
    delete process.env.PORT;
    assert.equal(resolveChatGptRedirectUri(), "http://127.0.0.1:3002/api/chatgpt/callback");
  });

  it("falls back to default when env value has no scheme", () => {
    process.env.CHATGPT_OAUTH_REDIRECT_URI = "mycozylibary.com/api/chatgpt/callback";
    delete process.env.PORT;
    assert.equal(resolveChatGptRedirectUri(), "http://127.0.0.1:3002/api/chatgpt/callback");
  });

  it("falls back to default when PORT contains CRLF (control-char injection guard)", () => {
    // Defense-in-depth (2026-06-24): the explicit CHATGPT_OAUTH_REDIRECT_URI
    // path already guards against CRLF; the PORT-derived default did not.
    // A mis-edited /etc/agata.env could otherwise leak control chars into
    // the OpenAI authorize URL and the public /api/chatgpt/redirect-uri
    // response body.
    delete process.env.CHATGPT_OAUTH_REDIRECT_URI;
    process.env.PORT = "3002\r\nSet-Cookie: x=y";
    assert.equal(resolveChatGptRedirectUri(), "http://127.0.0.1:3002/api/chatgpt/callback");
  });

  it("falls back to default when PORT is non-numeric (typo / unit suffix guard)", () => {
    delete process.env.CHATGPT_OAUTH_REDIRECT_URI;
    process.env.PORT = "3002tcp";
    assert.equal(resolveChatGptRedirectUri(), "http://127.0.0.1:3002/api/chatgpt/callback");
  });
});
