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

import { afterEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import { resolveChatGptRedirectUri } from "./oauth-redirect-uri";

const ORIGINAL_ENV = process.env.CHATGPT_OAUTH_REDIRECT_URI;

afterEach(() => {
  if (ORIGINAL_ENV === undefined) delete process.env.CHATGPT_OAUTH_REDIRECT_URI;
  else process.env.CHATGPT_OAUTH_REDIRECT_URI = ORIGINAL_ENV;
});

describe("resolveChatGptRedirectUri", () => {
  it("returns the explicit env value when set", () => {
    process.env.CHATGPT_OAUTH_REDIRECT_URI = "https://mycozylibary.com/api/chatgpt/callback";
    assert.equal(resolveChatGptRedirectUri(), "https://mycozylibary.com/api/chatgpt/callback");
  });

  it("falls back to the loopback URL when the env var is unset", () => {
    delete process.env.CHATGPT_OAUTH_REDIRECT_URI;
    assert.equal(resolveChatGptRedirectUri(), "http://127.0.0.1:3001/api/chatgpt/callback");
  });

  it("falls back to the loopback URL when the env var is whitespace-only", () => {
    process.env.CHATGPT_OAUTH_REDIRECT_URI = "   ";
    assert.equal(resolveChatGptRedirectUri(), "http://127.0.0.1:3001/api/chatgpt/callback");
  });

  it("trims a useful env value", () => {
    process.env.CHATGPT_OAUTH_REDIRECT_URI = "  https://mycozylibary.com/api/chatgpt/callback  ";
    assert.equal(resolveChatGptRedirectUri(), "https://mycozylibary.com/api/chatgpt/callback");
  });

  it("falls back to default when env value contains CRLF (header-injection guard)", () => {
    process.env.CHATGPT_OAUTH_REDIRECT_URI = "https://mycozylibary.com\r\nSet-Cookie: x=y";
    assert.equal(resolveChatGptRedirectUri(), "http://127.0.0.1:3001/api/chatgpt/callback");
  });

  it("falls back to default when env value is not an http(s) URL", () => {
    process.env.CHATGPT_OAUTH_REDIRECT_URI = "javascript:alert(1)";
    assert.equal(resolveChatGptRedirectUri(), "http://127.0.0.1:3001/api/chatgpt/callback");
  });

  it("falls back to default when env value has no scheme", () => {
    process.env.CHATGPT_OAUTH_REDIRECT_URI = "mycozylibary.com/api/chatgpt/callback";
    assert.equal(resolveChatGptRedirectUri(), "http://127.0.0.1:3001/api/chatgpt/callback");
  });
});
