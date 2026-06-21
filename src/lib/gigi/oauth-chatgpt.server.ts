// Agata — server-only ChatGPT OAuth token store.
//
// Tokens issued by the Codex OAuth flow are stored encrypted in the
// `settings` table. The encryption key lives in `/etc/agata.env`
// (`GIGI_TOKEN_KEY`, 32 random bytes base64-encoded) so the SQLite file
// alone is not enough to read the token at rest.
//
// This module is server-only — it imports `crypto.createCipheriv` and
// the DB client. Client code must use the pure helpers in
// `./oauth-chatgpt.ts` instead.
import "@tanstack/react-start/server-only";
import { createCipheriv, createDecipheriv, randomBytes, type CipherGCMTypes } from "node:crypto";

import { getSetting, setSetting, deleteSetting } from "@/lib/db/repositories/goals";
import {
  computeExpiresAt,
  isTokenExpired,
  needsRefresh as pureNeedsRefresh,
  REFRESH_LEEWAY_SECONDS,
} from "./oauth-chatgpt";

export const TOKEN_KEY = "gigi.chatgpt.token";
export const ACCOUNT_KEY = "gigi.chatgpt.accountId";

/** Encrypted token shape persisted in `settings.value`. */
export interface StoredToken {
  accessToken: string;
  refreshToken?: string;
  /** Absolute expiry timestamp (ms since epoch). */
  expiresAt: number;
  /** `chatgpt_account_id` extracted from the JWT — required as a request header. */
  accountId: string;
}

// ---------------------------------------------------------------------------
// AES-256-GCM encrypt/decrypt.
// ---------------------------------------------------------------------------

const ALGO: CipherGCMTypes = "aes-256-gcm";

function loadKey(): Buffer {
  const k = process.env.GIGI_TOKEN_KEY;
  if (!k) {
    throw new Error(
      "GIGI_TOKEN_KEY is not set. Generate 32 random bytes (base64) and add to /etc/agata.env.",
    );
  }
  const buf = Buffer.from(k, "base64");
  if (buf.length !== 32) {
    throw new Error(
      `GIGI_TOKEN_KEY must decode to exactly 32 bytes (got ${buf.length}). Regenerate with: openssl rand -base64 32`,
    );
  }
  return buf;
}

/**
 * Encrypt a stored token. Output format: `iv:tag:ciphertext`, all
 * base64url-encoded with no padding. 12-byte IV (GCM standard), 16-byte tag.
 */
export function encryptToken(token: StoredToken): string {
  const key = loadKey();
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGO, key, iv);
  const plaintext = Buffer.from(JSON.stringify(token), "utf8");
  const enc = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [iv.toString("base64url"), tag.toString("base64url"), enc.toString("base64url")].join(":");
}

/** Decrypt a stored token. Throws on bad key, tampered ciphertext, or malformed input. */
export function decryptToken(blob: string): StoredToken {
  const parts = blob.split(":");
  if (parts.length !== 3) throw new Error("invalid encrypted token format");
  const [ivPart, tagPart, ctPart] = parts;
  const key = loadKey();
  const iv = Buffer.from(ivPart, "base64url");
  const tag = Buffer.from(tagPart, "base64url");
  const ct = Buffer.from(ctPart, "base64url");
  const decipher = createDecipheriv(ALGO, key, iv);
  decipher.setAuthTag(tag);
  const dec = Buffer.concat([decipher.update(ct), decipher.final()]);
  return JSON.parse(dec.toString("utf8")) as StoredToken;
}

// ---------------------------------------------------------------------------
// Refresh helpers (mirror pure module but apply the "no refresh token"
// short-circuit so the chat path can decide what to do).
// ---------------------------------------------------------------------------

/** True when the token must be refreshed (past expiry OR within 5-min leeway). */
export function needsFreshToken(token: StoredToken, now: number = Date.now()): boolean {
  if (isTokenExpired(now, token.expiresAt)) return true;
  return pureNeedsRefresh(now, token.expiresAt);
}

/**
 * True when we have a refresh_token AND the access_token needs refreshing.
 * Use this to decide whether to call `/oauth/token` with grant_type=refresh_token.
 * Without a refresh_token, the user has to re-consent — surface a reconnect.
 */
export function isRefreshNeeded(token: StoredToken, now: number = Date.now()): boolean {
  if (!token.refreshToken) return false;
  return needsFreshToken(token, now);
}

/** Convenience: compute the absolute expiry for a freshly received token. */
export function computeNewExpiry(now: number, expiresInSeconds: number): number {
  return computeExpiresAt(now, expiresInSeconds);
}

/** Re-export the leeway constant so server-side callers don't need a second import. */
export const REFRESH_LEEWAY = REFRESH_LEEWAY_SECONDS;

// ---------------------------------------------------------------------------
// Settings-backed CRUD.
// ---------------------------------------------------------------------------

/** Persist a token (encrypted) plus the (plaintext) account id in settings. */
export async function saveStoredToken(token: StoredToken): Promise<void> {
  const blob = encryptToken(token);
  await setSetting(TOKEN_KEY, blob);
  // The account id is needed as a request header — not secret on its own,
  // but it also lets the UI show "połączono z kontem <id>" without
  // decrypting the whole blob.
  await setSetting(ACCOUNT_KEY, token.accountId);
}

/** Read + decrypt the persisted token, or `undefined` when not connected. */
export async function getStoredToken(): Promise<StoredToken | undefined> {
  const blob = await getSetting<string>(TOKEN_KEY);
  if (!blob) return undefined;
  try {
    return decryptToken(blob);
  } catch {
    // Corrupt or key-rotated. Treat as disconnected so the user can re-connect.
    return undefined;
  }
}

/** Remove both the encrypted token and the account id. */
export async function clearStoredToken(): Promise<void> {
  await deleteSetting(TOKEN_KEY);
  await deleteSetting(ACCOUNT_KEY);
}
