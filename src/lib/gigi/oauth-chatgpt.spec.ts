// Agata — tests for the pure PKCE / OAuth-URL / token-refresh module.
//
// These exercise the same code paths used by the OAuth routes but without
// standing up TanStack Start async-local-storage context or hitting the
// network. Everything in here must be deterministic — no real RNG, no
// Date.now() leaked into equality assertions (we pass `now` explicitly).
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";

import {
  buildAuthorizeUrl,
  generatePkcePair,
  isTokenExpired,
  needsRefresh,
  parseTokenResponse,
  type ChatGPTTokenResponse,
} from "./oauth-chatgpt";

describe("PKCE pair", () => {
  it("verifier is 43–128 base64url chars (RFC 7636)", () => {
    for (let i = 0; i < 20; i++) {
      const { verifier } = generatePkcePair();
      assert.ok(verifier.length >= 43, `verifier too short: ${verifier.length}`);
      assert.ok(verifier.length <= 128, `verifier too long: ${verifier.length}`);
      assert.match(verifier, /^[A-Za-z0-9_-]+$/, "must be unreserved base64url");
    }
  });

  it("challenge = base64url(SHA256(verifier))", () => {
    const { verifier, challenge, method } = generatePkcePair();
    assert.equal(method, "S256");
    // RFC 7636 §4.2: challenge = BASE64URL-ENCODE(SHA256(ASCII(code_verifier))).
    // i.e. SHA-256 the ASCII bytes of the verifier STRING, then base64url the
    // digest. The string itself happens to be base64url-shaped but that is a
    // transport encoding, not the thing being hashed.
    const hash = createHash("sha256").update(verifier, "utf8").digest();
    const expected = hash
      .toString("base64")
      .replace(/=/g, "")
      .replace(/\+/g, "-")
      .replace(/\//g, "_");
    assert.equal(challenge, expected);
  });

  it("two calls produce distinct pairs (random)", () => {
    const a = generatePkcePair();
    const b = generatePkcePair();
    assert.notEqual(a.verifier, b.verifier);
    assert.notEqual(a.challenge, b.challenge);
  });
});

describe("buildAuthorizeUrl", () => {
  it("produces an auth.openai.com authorize URL with required params", () => {
    const url = buildAuthorizeUrl({
      clientId: "app_TEST",
      redirectUri: "http://127.0.0.1:3001/api/chatgpt/callback",
      state: "abc123",
      codeChallenge: "challengeXYZ",
      scope: "openid profile email offline_access api.connectors.read api.connectors.invoke",
    });
    const u = new URL(url);
    assert.equal(u.origin + u.pathname, "https://auth.openai.com/oauth/authorize");
    assert.equal(u.searchParams.get("response_type"), "code");
    assert.equal(u.searchParams.get("client_id"), "app_TEST");
    assert.equal(u.searchParams.get("redirect_uri"), "http://127.0.0.1:3001/api/chatgpt/callback");
    assert.equal(u.searchParams.get("state"), "abc123");
    assert.equal(u.searchParams.get("code_challenge"), "challengeXYZ");
    assert.equal(u.searchParams.get("code_challenge_method"), "S256");
    // Updated to the 2026 Codex public client scope (api.connectors.* are
    // required by auth.openai.com — older scopes get an `unknown_error`
    // page in the consent flow).
    assert.equal(
      u.searchParams.get("scope"),
      "openid profile email offline_access api.connectors.read api.connectors.invoke",
    );
    assert.equal(u.searchParams.get("id_token_add_organizations"), "true");
    assert.equal(u.searchParams.get("codex_cli_simplified_flow"), "true");
  });

  it("accepts extra query params (e.g. prompt=consent)", () => {
    const url = buildAuthorizeUrl({
      clientId: "app_TEST",
      redirectUri: "http://127.0.0.1:3001/api/chatgpt/callback",
      state: "s",
      codeChallenge: "c",
      scope: "openid",
      extraParams: { prompt: "consent" },
    });
    const u = new URL(url);
    assert.equal(u.searchParams.get("prompt"), "consent");
  });

  it("uses the codex-style scope as DEFAULT_OAUTH_SCOPE (no override required)", () => {
    // Without an explicit `scope`, the URL must still advertise the
    // connector scopes that auth.openai.com currently requires. This is
    // the regression that produced the `unknown_error` consent-page
    // error reported on 2026-06-25.
    const url = buildAuthorizeUrl({
      clientId: "app_TEST",
      redirectUri: "http://127.0.0.1:3001/api/chatgpt/callback",
      state: "s",
      codeChallenge: "c",
    });
    const u = new URL(url);
    assert.match(
      u.searchParams.get("scope") ?? "",
      /api\.connectors\.read/,
      "default scope must include api.connectors.read for Codex public client",
    );
    assert.match(
      u.searchParams.get("scope") ?? "",
      /api\.connectors\.invoke/,
      "default scope must include api.connectors.invoke for Codex public client",
    );
  });
});

describe("parseTokenResponse", () => {
  it("extracts access_token, refresh_token, expires_in, account_id", () => {
    const body: ChatGPTTokenResponse = {
      access_token: "at",
      refresh_token: "rt",
      expires_in: 3600,
      id_token: "ey.fake.jwt",
    };
    const parsed = parseTokenResponse(body, "ey.fake.jwt");
    assert.equal(parsed.accessToken, "at");
    assert.equal(parsed.refreshToken, "rt");
    assert.equal(parsed.expiresIn, 3600);
    assert.equal(parsed.idToken, "ey.fake.jwt");
  });

  it("tolerates missing refresh_token (only on first exchange)", () => {
    const parsed = parseTokenResponse({ access_token: "at", expires_in: 60 }, undefined);
    assert.equal(parsed.refreshToken, undefined);
  });
});

describe("expiry / refresh math", () => {
  it("isTokenExpired: true when now > expiresAt", () => {
    assert.equal(isTokenExpired(1000, 999), true);
  });
  it("isTokenExpired: false when now < expiresAt", () => {
    assert.equal(isTokenExpired(999, 1000), false);
  });
  it("isTokenExpired: false when now == expiresAt (boundary)", () => {
    // Boundary exclusive — `now < expiresAt` keeps the token valid until
    // the clock strictly passes expiry. needsRefresh() takes care of the
    // pre-expiry proactive refresh.
    assert.equal(isTokenExpired(1000, 1000), false);
  });

  it("needsRefresh: true when expiresAt - now < 5 min", () => {
    // 299 s left → needs refresh
    assert.equal(needsRefresh(1000, 1000 + 299_000), true);
  });
  it("needsRefresh: false when expiresAt - now >= 5 min", () => {
    // 301 s left → still good
    assert.equal(needsRefresh(1000, 1000 + 301_000), false);
  });
  it("needsRefresh: true when already expired", () => {
    assert.equal(needsRefresh(1000, 999), true);
  });
});
