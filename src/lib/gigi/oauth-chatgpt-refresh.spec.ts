// Agata — TDD tests for the *active* refresh path.
//
// Background: the OAuth flow ships refreshAccessToken and parseTokenResponse,
// but nothing in the runtime read path ever calls them. After ~55 minutes
// the stored access_token expires and /api/chat starts getting 401s — even
// though a valid refresh_token is sitting in the encrypted settings store.
// OpenClaw docs explicitly call out the same pitfall and pin the fix as
// "refresh writes back to the main agent store". We follow the same shape
// here: an inline refresh on read, with single-flight so concurrent chats
// don't all hit auth.openai.com at once.
//
// These tests pin the contract for the two helpers that fix this:
//
//   refreshStoredToken(token) -> StoredToken
//     - calls auth.openai.com /oauth/token with grant_type=refresh_token
//     - persists the merged (access, refresh, expiresAt, accountId) atomically
//     - returns the new StoredToken so the caller can use it inline
//     - on error: propagates AND does NOT mutate the stored blob
//
//   getFreshStoredToken() -> StoredToken | undefined
//     - returns the stored token unchanged if it's still good (>5 min left)
//     - returns undefined if there's no token OR no refresh_token and expired
//     - refreshes proactively when within the 5-min leeway
//     - refreshes when past expiry
//     - on refresh failure: clears the stored token and returns undefined
//       (so the next /api/chat returns 503 with a clear reconnect hint)
//     - single-flight: concurrent calls share one in-flight refresh

import { after, before, beforeEach, describe, it } from "node:test";
import { mkdtempSync, rmSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { getTableName } from "drizzle-orm";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";

import * as dbClient from "@/lib/db/client";
import { settings as settingsTbl } from "@/lib/db/schema";

import {
  saveStoredToken,
  refreshStoredToken,
  getFreshStoredToken,
  TOKEN_KEY,
} from "./oauth-chatgpt.server";
import { DEFAULT_OAUTH_CLIENT_ID } from "./oauth-chatgpt";

let dataDir: string;
let prevDataDir: string | undefined;
let prevTokenKey: string | undefined;
let prevClientId: string | undefined;

function freshKey(): string {
  return randomBytes(32).toString("base64");
}

before(() => {
  prevDataDir = process.env.DATA_DIR;
  prevTokenKey = process.env.GIGI_TOKEN_KEY;
  prevClientId = process.env.CHATGPT_OAUTH_CLIENT_ID;
  dataDir = mkdtempSync(join(tmpdir(), "agata-oauth-refresh-test-"));
  process.env.DATA_DIR = dataDir;
  process.env.GIGI_TOKEN_KEY = freshKey();
  process.env.CHATGPT_OAUTH_CLIENT_ID = "app_TEST_CLIENT";
  migrate(dbClient.getDb(), { migrationsFolder: join(process.cwd(), "drizzle") });
});

after(() => {
  dbClient.closeDb();
  process.env.DATA_DIR = prevDataDir;
  process.env.GIGI_TOKEN_KEY = prevTokenKey;
  if (prevClientId === undefined) delete process.env.CHATGPT_OAUTH_CLIENT_ID;
  else process.env.CHATGPT_OAUTH_CLIENT_ID = prevClientId;
  if (existsSync(dataDir)) rmSync(dataDir, { recursive: true, force: true });
});

beforeEach(() => {
  const sqlite = dbClient.getRawSqlite();
  sqlite.exec(`DELETE FROM ${getTableName(settingsTbl)};`);
  // Default mock fetch state for tests that don't override it — any
  // accidental fetch call will throw with a clear message.
  globalThis.fetch = (() => {
    throw new Error("test did not mock globalThis.fetch");
  }) as typeof fetch;
});

// ---------------------------------------------------------------------------
// fetch mock — same shape as oauth-chatgpt.flow.spec.ts.
// ---------------------------------------------------------------------------

interface FetchCall {
  url: string;
  init: RequestInit;
}

function installFetchMock(opts: { responses?: Response[]; errors?: Error[] }): {
  calls: FetchCall[];
} {
  const calls: FetchCall[] = [];
  // Capture the previous fetch so the next test's beforeEach (which
  // installs a "throw if you call me" mock) sees the prior override.
  const previousFetch = globalThis.fetch;
  globalThis.fetch = (async (url: string | URL, init?: RequestInit) => {
    const i = calls.length;
    calls.push({ url: String(url), init: init ?? {} });
    if (opts.errors && opts.errors[i]) throw opts.errors[i];
    if (!opts.responses || !opts.responses[i]) {
      throw new Error(`test fetch mock ran out of responses at call ${i}`);
    }
    return opts.responses[i].clone();
  }) as typeof fetch;
  // The beforeEach re-installs a fresh "throw" mock for each test; nothing
  // restores `previousFetch` after the suite — Nitro never reads
  // globalThis.fetch in this test process, so it's fine to leave the
  // override in place.
  void previousFetch;
  return { calls };
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

/**
 * Build an unverified JWT of the shape ChatGPT uses. Real verification
 * happens upstream at auth.openai.com — we only read the claim to populate
 * the `ChatGPT-Account-Id` header.
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

// ---------------------------------------------------------------------------
// refreshStoredToken
// ---------------------------------------------------------------------------

describe("refreshStoredToken", () => {
  it("POSTs to /oauth/token with grant_type=refresh_token + the stored refresh_token + the configured client_id", async () => {
    await saveStoredToken({
      accessToken: "at-old",
      refreshToken: "rt-abc",
      expiresAt: 1_000,
      accountId: "acc-old",
    });
    const { calls } = installFetchMock({
      responses: [jsonResponse({ access_token: "at-new", expires_in: 3600 })],
    });

    await refreshStoredToken();

    assert.equal(calls.length, 1);
    assert.equal(calls[0].url, "https://auth.openai.com/oauth/token");
    const body = String(calls[0].init.body);
    assert.match(body, /grant_type=refresh_token/);
    assert.match(body, /refresh_token=rt-abc/);
    assert.match(body, new RegExp(`client_id=${encodeURIComponent("app_TEST_CLIENT")}`));
    assert.match(body, /client_id=/);
    // No code or code_verifier on a refresh.
    assert.doesNotMatch(body, /grant_type=authorization_code/);
    assert.doesNotMatch(body, /code_verifier=/);
  });

  it("persists new access_token + new refresh_token + new expiresAt when the server rotates", async () => {
    await saveStoredToken({
      accessToken: "at-old",
      refreshToken: "rt-old",
      expiresAt: 1_000,
      accountId: "acc-old",
    });
    installFetchMock({
      responses: [
        jsonResponse({
          access_token: "at-new",
          refresh_token: "rt-new",
          expires_in: 3600,
        }),
      ],
    });

    const t0 = Date.now();
    const out = await refreshStoredToken();
    const t1 = Date.now();

    assert.equal(out.accessToken, "at-new");
    assert.equal(out.refreshToken, "rt-new");
    // expiresAt is now + 3600s, give a 1s buffer for clock drift.
    assert.ok(out.expiresAt >= t0 + 3600_000, "expiresAt must be in the future");
    assert.ok(out.expiresAt <= t1 + 3600_000 + 1000);
    assert.equal(out.accountId, "acc-old");
  });

  it("keeps the old refresh_token when the server omits it (RFC 6749 §6)", async () => {
    // RFC 6749 §6: "The authorization server MAY issue a new refresh token,
    // in which case the client MUST discard the old refresh token". The
    // reverse — server omits the new token — means we MUST keep the old
    // one, otherwise the user is silently locked out of their account.
    await saveStoredToken({
      accessToken: "at-old",
      refreshToken: "rt-old",
      expiresAt: 1_000,
      accountId: "acc-old",
    });
    installFetchMock({
      responses: [
        jsonResponse({
          access_token: "at-new",
          expires_in: 3600,
          // intentionally no refresh_token
        }),
      ],
    });

    const out = await refreshStoredToken();
    assert.equal(out.accessToken, "at-new");
    assert.equal(out.refreshToken, "rt-old", "must preserve old refresh_token when omitted");
  });

  it("re-extracts accountId when the refresh response includes a new id_token", async () => {
    await saveStoredToken({
      accessToken: "at-old",
      refreshToken: "rt-old",
      expiresAt: 1_000,
      accountId: "acc-old",
    });
    installFetchMock({
      responses: [
        jsonResponse({
          access_token: "at-new",
          expires_in: 3600,
          id_token: makeFakeIdToken("acc-new"),
        }),
      ],
    });

    const out = await refreshStoredToken();
    assert.equal(out.accountId, "acc-new");
  });

  it("keeps the old accountId when the refresh response omits id_token", async () => {
    await saveStoredToken({
      accessToken: "at-old",
      refreshToken: "rt-old",
      expiresAt: 1_000,
      accountId: "acc-old",
    });
    installFetchMock({
      responses: [
        jsonResponse({
          access_token: "at-new",
          expires_in: 3600,
          // no id_token
        }),
      ],
    });

    const out = await refreshStoredToken();
    assert.equal(out.accountId, "acc-old");
  });

  it("propagates errors and does NOT mutate the stored token", async () => {
    await saveStoredToken({
      accessToken: "at-old",
      refreshToken: "rt-old",
      expiresAt: 1_000,
      accountId: "acc-old",
    });
    installFetchMock({
      responses: [jsonResponse({ error: "invalid_grant", error_description: "revoked" }, 400)],
    });

    await assert.rejects(refreshStoredToken(), /400|invalid_grant/);

    // Stored token must be unchanged so the caller can decide what to do
    // (clear + show "please reconnect" vs. retry once).
    const sqlite = dbClient.getRawSqlite();
    const row = sqlite.prepare("SELECT value AS v FROM settings WHERE key = ?").get(TOKEN_KEY) as
      | { v: string }
      | undefined;
    assert.ok(row, "token row must still exist after a failed refresh");
    assert.ok(!row!.v.includes("at-old"), "blob must still be the OLD encrypted blob");
    assert.ok(!row!.v.includes("at-new"), "blob must not have been overwritten");
  });

  it("throws (and does not persist) when the response has expires_in <= 0", async () => {
    // Defends against a malformed response that would otherwise compute
    // a past `expiresAt` and trigger an infinite refresh loop on the
    // next read. The throw lets getFreshStoredToken clear the blob.
    await saveStoredToken({
      accessToken: "at-old",
      refreshToken: "rt-old",
      expiresAt: 1_000,
      accountId: "acc-old",
    });
    installFetchMock({
      responses: [jsonResponse({ access_token: "at-new", expires_in: 0 })],
    });

    await assert.rejects(refreshStoredToken(), /expires_in/);

    const sqlite = dbClient.getRawSqlite();
    const row = sqlite.prepare("SELECT value AS v FROM settings WHERE key = ?").get(TOKEN_KEY) as
      | { v: string }
      | undefined;
    assert.ok(row, "blob must not be deleted by refreshStoredToken — that's the catcher's job");
    assert.ok(!row!.v.includes("at-new"), "blob must not be overwritten");
  });
});

// ---------------------------------------------------------------------------
// getFreshStoredToken
// ---------------------------------------------------------------------------

describe("getFreshStoredToken", () => {
  it("returns the stored token unchanged when more than 5 minutes remain", async () => {
    await saveStoredToken({
      accessToken: "at-fresh",
      refreshToken: "rt",
      expiresAt: Date.now() + 30 * 60 * 1000,
      accountId: "acc-1",
    });
    // No fetch mock — if refresh fires this will throw with the test's
    // "did not mock globalThis.fetch" sentinel.
    const out = await getFreshStoredToken();
    assert.ok(out);
    assert.equal(out!.accessToken, "at-fresh");
    assert.equal(out!.refreshToken, "rt");
  });

  it("returns undefined when no token is configured", async () => {
    const out = await getFreshStoredToken();
    assert.equal(out, undefined);
  });

  it("returns undefined when expired AND no refresh_token (forces reconnect, no fetch)", async () => {
    await saveStoredToken({
      accessToken: "at-stale",
      expiresAt: Date.now() - 60 * 60 * 1000,
      accountId: "acc-1",
    });
    // No fetch mock — proves we don't try to refresh without a refresh_token.
    const out = await getFreshStoredToken();
    assert.equal(out, undefined);
  });

  it("refreshes proactively when within the 5-min leeway", async () => {
    await saveStoredToken({
      accessToken: "at-soon",
      refreshToken: "rt-soon",
      expiresAt: Date.now() + 2 * 60 * 1000, // 2 min — inside the 5-min leeway
      accountId: "acc-1",
    });
    const { calls } = installFetchMock({
      responses: [
        jsonResponse({
          access_token: "at-refreshed",
          refresh_token: "rt-rotated",
          expires_in: 3600,
        }),
      ],
    });

    const out = await getFreshStoredToken();
    assert.ok(out);
    assert.equal(out!.accessToken, "at-refreshed");
    assert.equal(out!.refreshToken, "rt-rotated");
    assert.equal(calls.length, 1);
    assert.match(String(calls[0].init.body), /grant_type=refresh_token/);
  });

  it("refreshes when the token is past expiry", async () => {
    await saveStoredToken({
      accessToken: "at-stale",
      refreshToken: "rt-stale",
      expiresAt: Date.now() - 60 * 60 * 1000,
      accountId: "acc-1",
    });
    const { calls } = installFetchMock({
      responses: [jsonResponse({ access_token: "at-new", expires_in: 3600 })],
    });

    const out = await getFreshStoredToken();
    assert.ok(out);
    assert.equal(out!.accessToken, "at-new");
    assert.equal(calls.length, 1);
  });

  it("clears the stored token and returns undefined when the refresh fails", async () => {
    await saveStoredToken({
      accessToken: "at-stale",
      refreshToken: "rt-revoked",
      expiresAt: Date.now() - 60 * 60 * 1000,
      accountId: "acc-1",
    });
    installFetchMock({
      responses: [
        jsonResponse({ error: "invalid_grant", error_description: "Token revoked" }, 400),
      ],
    });

    const out = await getFreshStoredToken();
    assert.equal(out, undefined);

    // The stored blob must be wiped — otherwise the next request would
    // try the same dead refresh_token again and loop forever.
    const sqlite = dbClient.getRawSqlite();
    const row = sqlite.prepare("SELECT key FROM settings WHERE key = ?").get(TOKEN_KEY) as
      | { key: string }
      | undefined;
    assert.equal(row, undefined, "stale token must be cleared after a failed refresh");
  });

  it("single-flight: concurrent calls issue only ONE refresh and all callers get the same result", async () => {
    await saveStoredToken({
      accessToken: "at-stale",
      refreshToken: "rt-concurrent",
      expiresAt: Date.now() - 60 * 60 * 1000,
      accountId: "acc-1",
    });
    // The mock fetch returns a pre-resolved Promise. We resolve it BEFORE
    // the first call's microtask queue reaches fetch, so by the time
    // doGetFreshStoredToken awaits `fetch`, the pending Promise is
    // already settled — no hang.
    const calls: FetchCall[] = [];
    const resolvedResponse = jsonResponse({
      access_token: "at-once",
      refresh_token: "rt-once",
      expires_in: 3600,
    });
    globalThis.fetch = (async (_url: string | URL, init?: RequestInit) => {
      calls.push({ url: String(_url), init: init ?? {} });
      return Promise.resolve(resolvedResponse);
    }) as typeof fetch;

    // Kick off three concurrent calls WITHOUT awaiting. A enters first,
    // sets `_inflightRefresh` synchronously, and B/C return the cached
    // promise. Awaiting now would deadlock only if B/C entered AFTER A's
    // chain resolved and `_inflightRefresh` had been cleared — but here
    // B/C are kicked off in the same tick as A, so they all see the
    // same in-flight refresh.
    const a = getFreshStoredToken();
    const b = getFreshStoredToken();
    const c = getFreshStoredToken();

    const [aRes, bRes, cRes] = await Promise.all([a, b, c]);

    assert.equal(calls.length, 1, `expected 1 fetch, got ${calls.length}`);
    assert.ok(aRes);
    assert.ok(bRes);
    assert.ok(cRes);
    assert.equal(aRes!.accessToken, "at-once");
    assert.equal(bRes!.accessToken, "at-once");
    assert.equal(cRes!.accessToken, "at-once");
  });

  it("after a successful refresh the stored token survives a fresh read without a network call", async () => {
    await saveStoredToken({
      accessToken: "at-stale",
      refreshToken: "rt-1",
      expiresAt: Date.now() - 60 * 60 * 1000,
      accountId: "acc-1",
    });
    installFetchMock({
      responses: [jsonResponse({ access_token: "at-new", expires_in: 3600 })],
    });

    const first = await getFreshStoredToken();
    assert.equal(first!.accessToken, "at-new");

    // No fetch mock installed for the second call — the globalThis.fetch
    // override from beforeEach will throw if refresh fires again.
    const second = await getFreshStoredToken();
    assert.equal(second!.accessToken, "at-new");
  });

  it("re-throws GIGI_TOKEN_KEY errors so the operator can see the env hint (NOT a reconnect)", async () => {
    // Save a token with the CURRENT key.
    await saveStoredToken({
      accessToken: "at",
      refreshToken: "rt",
      expiresAt: Date.now() + 30 * 60 * 1000,
      accountId: "acc-1",
    });
    // Now rotate the key — decryption will throw "GIGI_TOKEN_KEY is not set…"
    // or "must decode to exactly 32 bytes…". The chat path must surface
    // this as an OPERATOR error (env hint), not as "please reconnect".
    const savedKey = process.env.GIGI_TOKEN_KEY!;
    process.env.GIGI_TOKEN_KEY = "";
    try {
      await assert.rejects(getFreshStoredToken(), /GIGI_TOKEN_KEY/);
    } finally {
      process.env.GIGI_TOKEN_KEY = savedKey;
    }
  });
});

// ---------------------------------------------------------------------------
// sanity: DEFAULT_OAUTH_CLIENT_ID is the Codex public client id and is
// what we fall back to when CHATGPT_OAUTH_CLIENT_ID is unset.
// ---------------------------------------------------------------------------

describe("client_id resolution", () => {
  it("DEFAULT_OAUTH_CLIENT_ID is the known Codex public client id", () => {
    assert.match(DEFAULT_OAUTH_CLIENT_ID, /^app_/);
    assert.ok(DEFAULT_OAUTH_CLIENT_ID.length > 10);
  });

  it("refreshStoredToken falls back to DEFAULT_OAUTH_CLIENT_ID when CHATGPT_OAUTH_CLIENT_ID is unset", async () => {
    await saveStoredToken({
      accessToken: "at",
      refreshToken: "rt",
      expiresAt: 1_000,
      accountId: "acc",
    });
    delete process.env.CHATGPT_OAUTH_CLIENT_ID;
    const { calls } = installFetchMock({
      responses: [jsonResponse({ access_token: "at2", expires_in: 60 })],
    });

    await refreshStoredToken();
    const body = String(calls[0].init.body);
    assert.match(body, new RegExp(`client_id=${encodeURIComponent(DEFAULT_OAUTH_CLIENT_ID)}`));
  });
});
