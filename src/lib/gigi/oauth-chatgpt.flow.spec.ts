// Agata — tests for the OAuth token-exchange + refresh helpers.
//
// These wrap `fetch` against `https://auth.openai.com/oauth/token`. We mock
// `fetch` via a global override so the tests stay offline.
import { afterEach, beforeEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  CHATGPT_AUTH_BASE,
  type ChatGPTTokenResponse,
  DEFAULT_OAUTH_CLIENT_ID,
  extractAccountIdFromIdToken,
  parseTokenResponse,
} from "./oauth-chatgpt";
import { exchangeCodeForToken, refreshAccessToken } from "./oauth-chatgpt.flow";

interface FetchCall {
  url: string;
  init: RequestInit;
}

const calls: FetchCall[] = [];
let response: Response | undefined;
let nextError: Error | undefined;

const realFetch = globalThis.fetch;
beforeEach(() => {
  calls.length = 0;
  response = undefined;
  nextError = undefined;
  globalThis.fetch = (async (url: string | URL, init?: RequestInit) => {
    calls.push({ url: String(url), init: init ?? {} });
    if (nextError) throw nextError;
    if (!response) throw new Error("test forgot to set response");
    return response.clone();
  }) as typeof fetch;
});
afterEach(() => {
  globalThis.fetch = realFetch;
});

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

describe("exchangeCodeForToken", () => {
  it("POSTs to /oauth/token with grant_type=authorization_code", async () => {
    const tokenBody: ChatGPTTokenResponse = {
      access_token: "at",
      refresh_token: "rt",
      expires_in: 3600,
      id_token: makeFakeIdToken("acc-XYZ"),
    };
    response = jsonResponse(tokenBody);
    const parsed = await exchangeCodeForToken({
      clientId: DEFAULT_OAUTH_CLIENT_ID,
      code: "auth-code-1",
      codeVerifier: "verifier-1234567890",
      redirectUri: "http://127.0.0.1:3001/api/chatgpt/callback",
    });
    assert.equal(calls.length, 1);
    assert.equal(calls[0].url, `${CHATGPT_AUTH_BASE}/oauth/token`);
    assert.match(calls[0].init.method ?? "", /POST/);
    const headers = calls[0].init.headers as Record<string, string>;
    assert.equal(headers["content-type"], "application/x-www-form-urlencoded");
    const body = String(calls[0].init.body);
    assert.match(body, /grant_type=authorization_code/);
    assert.match(body, /code=auth-code-1/);
    assert.match(body, /client_id=/);
    assert.match(body, /code_verifier=verifier-1234567890/);
    assert.equal(parsed.accessToken, "at");
    assert.equal(parsed.refreshToken, "rt");
    assert.equal(parsed.expiresIn, 3600);
  });

  it("returns parsed shape, not the raw OpenAI response", async () => {
    response = jsonResponse({ access_token: "x", expires_in: 60 });
    const parsed = await exchangeCodeForToken({
      clientId: DEFAULT_OAUTH_CLIENT_ID,
      code: "c",
      codeVerifier: "v",
      redirectUri: "http://x/cb",
    });
    // Round-trip via parseTokenResponse must yield identical fields.
    const expected = parseTokenResponse({ access_token: "x", expires_in: 60 });
    assert.deepEqual(parsed, expected);
  });

  it("surfaces a non-2xx with the response body attached", async () => {
    response = jsonResponse({ error: "invalid_grant" }, 400);
    await assert.rejects(
      () =>
        exchangeCodeForToken({
          clientId: DEFAULT_OAUTH_CLIENT_ID,
          code: "bad",
          codeVerifier: "v",
          redirectUri: "http://x/cb",
        }),
      /invalid_grant|400/,
    );
  });
});

describe("refreshAccessToken", () => {
  it("POSTs grant_type=refresh_token with the refresh_token", async () => {
    response = jsonResponse({ access_token: "at2", expires_in: 3600 });
    await refreshAccessToken({
      clientId: DEFAULT_OAUTH_CLIENT_ID,
      refreshToken: "rt-1",
    });
    assert.equal(calls.length, 1);
    const body = String(calls[0].init.body);
    assert.match(body, /grant_type=refresh_token/);
    assert.match(body, /refresh_token=rt-1/);
  });
});

describe("extractAccountIdFromIdToken", () => {
  it("pulls chatgpt_account_id from the unverified JWT payload", () => {
    const idToken = makeFakeIdToken("acc-42");
    assert.equal(extractAccountIdFromIdToken(idToken), "acc-42");
  });

  it("returns undefined on a malformed token", () => {
    assert.equal(extractAccountIdFromIdToken("not-a-jwt"), undefined);
  });
});

/**
 * Build an *unverified* JWT of the shape ChatGPT uses:
 *   { header: {alg: "none", typ: "JWT"}, payload: { "https://api.openai.com/auth": { chatgpt_account_id: <id> } } }
 * Real verification happens upstream at auth.openai.com — we only read
 * the claim to populate a request header.
 */
function makeFakeIdToken(accountId: string): string {
  const enc = (o: unknown) =>
    Buffer.from(JSON.stringify(o))
      .toString("base64")
      .replace(/=+$/g, "")
      .replace(/\+/g, "-")
      .replace(/\//g, "_");
  return [
    enc({ alg: "none", typ: "JWT" }),
    enc({ "https://api.openai.com/auth": { chatgpt_account_id: accountId } }),
    "fake-sig",
  ].join(".");
}
