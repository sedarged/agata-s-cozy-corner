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
  DEFAULT_OAUTH_CLIENT_ID,
  extractAccountIdFromIdToken,
  isTokenExpired,
  needsRefresh as pureNeedsRefresh,
  type ParsedToken,
  REFRESH_LEEWAY_SECONDS,
} from "./oauth-chatgpt";
import { refreshAccessToken } from "./oauth-chatgpt.flow";

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
  } catch (err) {
    // Distinguish "operator forgot /etc/agata.env GIGI_TOKEN_KEY" (a fixable
    // server-side error — surface it loudly so the operator notices) from
    // "blob is corrupt or key was rotated" (the user has to re-consent).
    // The chat path propagates GIGI_TOKEN_KEY errors so the operator sees
    // a clear hint instead of "OAuth disconnected".
    if (err instanceof Error && err.message.startsWith("GIGI_TOKEN_KEY")) throw err;
    // Corrupt or key-rotated. Treat as disconnected so the user can re-connect.
    return undefined;
  }
}

/** Remove both the encrypted token and the account id. */
export async function clearStoredToken(): Promise<void> {
  await deleteSetting(TOKEN_KEY);
  await deleteSetting(ACCOUNT_KEY);
}

// ---------------------------------------------------------------------------
// Refresh-on-read (the fix for the "Gigi stops working after ~55 min" bug).
//
// OpenClaw's docs call this out explicitly: "refresh writes back to the
// main agent store". We do the same here — the read path is responsible
// for keeping the token fresh so /api/chat doesn't 401 mid-session.
//
// Rules (pinned by `oauth-chatgpt-refresh.spec.ts`):
//   - Access token always replaced from the refresh response.
//   - Refresh token replaced ONLY when the server sends one. RFC 6749 §6
//     allows the server to omit it; in that case we keep the old refresh
//     token — otherwise the user is silently locked out of their account.
//   - accountId re-extracted from the new id_token if present, else the
//     old value is preserved (account IDs are stable for a subscription
//     but we don't want to depend on that).
//   - On refresh failure: blob is NOT mutated; caller decides whether to
//     clear it. `getFreshStoredToken` clears + returns undefined so the
//     next /api/chat surfaces a clean "please reconnect" 503.
//   - Concurrent callers share one in-flight refresh (single-flight) so
//     a burst of chats doesn't fan out into N refresh requests.
// ---------------------------------------------------------------------------

/**
 * Refresh the persisted ChatGPT OAuth token in-place and return the new
 * (decrypted) `StoredToken`.
 *
 * Reads the current token via `getStoredToken`, calls
 * `https://auth.openai.com/oauth/token` with `grant_type=refresh_token`,
 * merges the response, persists via `saveStoredToken`, and returns the
 * merged value so the caller can use it inline.
 *
 * On HTTP / parse errors the persisted blob is NOT mutated — the caller
 * (`getFreshStoredToken`) uses that signal to clear + return undefined
 * instead of looping on the same dead refresh_token.
 *
 * @throws when the stored token has no `refreshToken`. Callers should
 *         gate on `isRefreshNeeded` (which tolerates the missing-refresh
 *         case) before calling.
 */
export async function refreshStoredToken(): Promise<StoredToken> {
  const current = await getStoredToken();
  if (!current) {
    throw new Error("refreshStoredToken: no stored token");
  }
  if (!current.refreshToken) {
    throw new Error("refreshStoredToken: stored token has no refresh_token (user must re-consent)");
  }
  const clientId = process.env.CHATGPT_OAUTH_CLIENT_ID || DEFAULT_OAUTH_CLIENT_ID;
  const fresh = await refreshAccessToken({
    clientId,
    refreshToken: current.refreshToken,
  });
  return persistRefreshedToken(current, fresh);
}

/**
 * Merge a parsed refresh response into the existing StoredToken and
 * persist. Module-private so the merge rules stay in one place — the
 * public surface (`refreshStoredToken` / `getFreshStoredToken`) wraps
 * this with single-flight + failure handling.
 */
async function persistRefreshedToken(
  current: StoredToken,
  fresh: ParsedToken,
): Promise<StoredToken> {
  // Guard against a malformed refresh response. `expires_in: 0` or NaN
  // would produce a `computeExpiresAt(now, 0) = now` expiry → next read
  // sees an already-expired token → infinite refresh loop. We throw so
  // `getFreshStoredToken` can clear the blob + return undefined instead.
  if (!Number.isFinite(fresh.expiresIn) || fresh.expiresIn <= 0) {
    throw new Error(
      `refresh response missing or invalid expires_in (got ${JSON.stringify(fresh.expiresIn)})`,
    );
  }
  const accountIdFromIdToken = fresh.idToken
    ? extractAccountIdFromIdToken(fresh.idToken)
    : undefined;
  const merged: StoredToken = {
    accessToken: fresh.accessToken,
    refreshToken: fresh.refreshToken ?? current.refreshToken,
    expiresAt: computeExpiresAt(Date.now(), fresh.expiresIn),
    accountId: accountIdFromIdToken ?? current.accountId,
  };
  await saveStoredToken(merged);
  return merged;
}

// Module-level single-flight promise. Only ONE refresh is in flight at a
// time across the whole Nitro process — concurrent chats share the
// result instead of stampeding auth.openai.com / burning the user's
// rate-limit budget.
let _inflightRefresh: Promise<StoredToken | undefined> | undefined;

/**
 * Read the stored ChatGPT token, refreshing inline if it's past expiry
 * or within the 5-min leeway. This is what the chat path calls.
 *
 *   - Nothing stored (user never connected) → undefined.
 *   - Token is good (>5 min left) → returns it unchanged, no network.
 *   - Token expired AND no refresh_token → undefined (the user has to
 *     re-consent via Settings → Połącz ChatGPT).
 *   - Token expired / inside leeway AND has refresh_token → single-flight
 *     refresh, persist + return the merged token.
 *   - Refresh failed (invalid_grant, network, etc.) → blob is cleared
 *     and undefined is returned so the next /api/chat surfaces a clean
 *     503 with a reconnect hint instead of looping on the same dead
 *     refresh_token.
 */
export async function getFreshStoredToken(): Promise<StoredToken | undefined> {
  if (_inflightRefresh) return _inflightRefresh;
  _inflightRefresh = doGetFreshStoredToken().finally(() => {
    _inflightRefresh = undefined;
  });
  return _inflightRefresh;
}

async function doGetFreshStoredToken(): Promise<StoredToken | undefined> {
  const current = await getStoredToken();
  if (!current) return undefined;
  const now = Date.now();
  // Good token: return as-is. `pureNeedsRefresh` already accounts for the
  // 5-min leeway so we refresh proactively instead of waiting for the
  // next request to fail with 401.
  if (!pureNeedsRefresh(now, current.expiresAt) && !isTokenExpired(now, current.expiresAt)) {
    return current;
  }
  // No refresh_token: caller must re-consent. Don't try to call
  // /oauth/token — it would just fail with `invalid_grant`.
  if (!current.refreshToken) return undefined;
  try {
    return await refreshStoredToken();
  } catch {
    // Clear the dead blob so the next call surfaces the same disconnect
    // state instead of looping through the same failing refresh_token.
    // We swallow the error and return undefined — the chat path will
    // turn that into a 503 with the reconnect hint.
    await clearStoredToken();
    return undefined;
  }
}
