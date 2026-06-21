// Agata — tests for the server-only OAuth ChatGPT token store.
//
// Covers: AES-256-GCM encrypt/decrypt roundtrip, wrong-key failure,
// expiry-driven refresh logic, and the CRUD wrapper around the
// `settings` table.
//
// The token store imports `process.env.GIGI_TOKEN_KEY` at first call,
// so each test sets the env explicitly. The DB is a real better-sqlite3
// against a tmpdir (mirroring the pattern in `src/lib/db/db.test.ts`).
import { after, before, beforeEach, describe, it } from "node:test";
import { mkdtempSync, rmSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";

import { migrate } from "drizzle-orm/better-sqlite3/migrator";

import * as dbClient from "@/lib/db/client";
import { settings as settingsTbl } from "@/lib/db/schema";
import { getTableName } from "drizzle-orm";

import {
  type StoredToken,
  decryptToken,
  encryptToken,
  getStoredToken,
  isRefreshNeeded,
  needsFreshToken,
  saveStoredToken,
  clearStoredToken,
  TOKEN_KEY,
  ACCOUNT_KEY,
} from "./oauth-chatgpt.server";

let dataDir: string;
let prevDataDir: string | undefined;
let prevTokenKey: string | undefined;

function freshKey(): string {
  // 32 random bytes base64-encoded — AES-256 needs exactly 32 bytes.
  return randomBytes(32).toString("base64");
}

before(() => {
  prevDataDir = process.env.DATA_DIR;
  prevTokenKey = process.env.GIGI_TOKEN_KEY;
  dataDir = mkdtempSync(join(tmpdir(), "agata-oauth-test-"));
  process.env.DATA_DIR = dataDir;
  process.env.GIGI_TOKEN_KEY = freshKey();
  migrate(dbClient.getDb(), { migrationsFolder: join(process.cwd(), "drizzle") });
});

after(() => {
  dbClient.closeDb();
  process.env.DATA_DIR = prevDataDir;
  process.env.GIGI_TOKEN_KEY = prevTokenKey;
  if (existsSync(dataDir)) rmSync(dataDir, { recursive: true, force: true });
});

beforeEach(() => {
  const sqlite = dbClient.getRawSqlite();
  sqlite.exec(`DELETE FROM ${getTableName(settingsTbl)};`);
});

describe("encryptToken / decryptToken", () => {
  it("round-trips a token", () => {
    const enc = encryptToken({
      accessToken: "secret-access",
      refreshToken: "secret-refresh",
      expiresAt: 1234567890,
      accountId: "acc-1",
    });
    // Stored value is a base64url blob, not the plaintext access token.
    assert.ok(!enc.includes("secret-access"));
    const dec = decryptToken(enc);
    assert.equal(dec.accessToken, "secret-access");
    assert.equal(dec.refreshToken, "secret-refresh");
    assert.equal(dec.expiresAt, 1234567890);
    assert.equal(dec.accountId, "acc-1");
  });

  it("fails with the wrong key", () => {
    const enc = encryptToken({
      accessToken: "secret",
      expiresAt: 1234567890,
      accountId: "acc",
    });
    const goodKey = process.env.GIGI_TOKEN_KEY!;
    process.env.GIGI_TOKEN_KEY = freshKey();
    assert.throws(() => decryptToken(enc), /auth|tag|invalid|GCM/i);
    process.env.GIGI_TOKEN_KEY = goodKey;
  });

  it("rejects missing/short GIGI_TOKEN_KEY at encrypt time", () => {
    const saved = process.env.GIGI_TOKEN_KEY!;
    process.env.GIGI_TOKEN_KEY = "tooshort";
    assert.throws(
      () =>
        encryptToken({
          accessToken: "x",
          expiresAt: 1,
          accountId: "a",
        }),
      /GIGI_TOKEN_KEY/,
    );
    process.env.GIGI_TOKEN_KEY = saved;
  });
});

describe("refresh math (server-side)", () => {
  it("needsFreshToken when expiresAt is in the past", () => {
    const token: StoredToken = {
      accessToken: "a",
      expiresAt: 1000,
      accountId: "acc",
    };
    assert.equal(needsFreshToken(token, 5000), true);
  });

  it("needsFreshToken when expiresAt - now < 5 min", () => {
    const token: StoredToken = {
      accessToken: "a",
      expiresAt: 1000 + 4 * 60 * 1000,
      accountId: "acc",
    };
    assert.equal(needsFreshToken(token, 1000), true);
  });

  it("needsFreshToken false when more than 5 min left", () => {
    const token: StoredToken = {
      accessToken: "a",
      expiresAt: 1000 + 30 * 60 * 1000,
      accountId: "acc",
    };
    assert.equal(needsFreshToken(token, 1000), false);
  });

  it("isRefreshNeeded mirrors needsFreshToken but tolerates missing refreshToken", () => {
    const token: StoredToken = {
      accessToken: "a",
      refreshToken: undefined,
      expiresAt: 1000 + 30 * 60 * 1000,
      accountId: "acc",
    };
    // Token still good — no refresh needed even without refresh token.
    assert.equal(isRefreshNeeded(token, 1000), false);
    // Stale token WITHOUT refresh token → user must re-consent, NOT auto-refresh.
    const staleNoRefresh: StoredToken = { ...token, expiresAt: 1000 };
    assert.equal(isRefreshNeeded(staleNoRefresh, 5000), false);
    // Stale token WITH refresh token → refresh is needed (the chat path can call it).
    const staleWithRefresh: StoredToken = {
      accessToken: "a",
      refreshToken: "rt",
      expiresAt: 1000,
      accountId: "acc",
    };
    assert.equal(isRefreshNeeded(staleWithRefresh, 5000), true);
  });
});

describe("settings-backed CRUD", () => {
  it("saveStoredToken persists encrypted blob; plaintext never reaches SQLite", async () => {
    await saveStoredToken({
      accessToken: "plaintext-must-not-leak",
      refreshToken: "rt",
      expiresAt: 9_999_999_999,
      accountId: "acc-42",
    });
    const sqlite = dbClient.getRawSqlite();
    const row = sqlite.prepare("SELECT value AS v FROM settings WHERE key = ?").get(TOKEN_KEY) as
      | { v: string }
      | undefined;
    assert.ok(row, "token row should exist");
    assert.ok(!row!.v.includes("plaintext-must-not-leak"), "plaintext must be encrypted");
    // The account_id key is stored plaintext (not secret — just an id).
    const accRow = sqlite
      .prepare("SELECT value AS v FROM settings WHERE key = ?")
      .get(ACCOUNT_KEY) as { v: string };
    assert.equal(accRow.v, '"acc-42"');
  });

  it("getStoredToken decrypts on read", async () => {
    await saveStoredToken({
      accessToken: "at-2",
      refreshToken: "rt-2",
      expiresAt: 1_700_000_000_000,
      accountId: "acc-2",
    });
    const got = await getStoredToken();
    assert.ok(got);
    assert.equal(got!.accessToken, "at-2");
    assert.equal(got!.refreshToken, "rt-2");
    assert.equal(got!.expiresAt, 1_700_000_000_000);
    assert.equal(got!.accountId, "acc-2");
  });

  it("clearStoredToken removes both keys", async () => {
    await saveStoredToken({
      accessToken: "x",
      expiresAt: 1,
      accountId: "y",
    });
    await clearStoredToken();
    assert.equal(await getStoredToken(), undefined);
    const sqlite = dbClient.getRawSqlite();
    const keys = (sqlite.prepare("SELECT key FROM settings").all() as { key: string }[]).map(
      (r) => r.key,
    );
    assert.ok(!keys.includes(TOKEN_KEY));
    assert.ok(!keys.includes(ACCOUNT_KEY));
  });

  it("getStoredToken returns undefined when not configured", async () => {
    assert.equal(await getStoredToken(), undefined);
  });
});
