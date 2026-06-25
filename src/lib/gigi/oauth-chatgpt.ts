// Agata — pure PKCE / OAuth-URL / token-refresh helpers for the ChatGPT
// "Sign in with ChatGPT" flow.
//
// This module is intentionally free of any server-only imports (no DB,
// no Node-only crypto, no fetch). It can be imported from client code
// (the Settings UI) and unit tests. The server-only side — encrypted
// token storage, HTTP exchanges — lives in `./oauth-chatgpt.server.ts`.
//
// Reference implementation: openai/codex (opencode #3281, Zed PR #56811).
// The endpoints / client_id / scopes are unofficial (Codex public client).
import { randomBytes, createHash } from "node:crypto";

// ---------------------------------------------------------------------------
// Public endpoints (verified against openai/codex eb8c1ee).
// ---------------------------------------------------------------------------

export const CHATGPT_AUTH_BASE = "https://auth.openai.com";
export const CHATGPT_API_BASE = "https://chatgpt.com/backend-api/codex";
export const DEFAULT_OAUTH_CLIENT_ID = "app_EMoamEEZ73f0CkXaXp7hrann";
// Scope required by auth.openai.com for the Codex public client as of
// 2026-06 — `api.connectors.read` + `api.connectors.invoke` are needed
// alongside the OIDC basics, otherwise the consent page returns
// `unknown_error` (reported 2026-06-25). Pinned by `oauth-chatgpt.spec.ts`.
// Reference: openai/codex eb8c1ee (codex-rs/login/src/server.rs).
export const DEFAULT_OAUTH_SCOPE =
  "openid profile email offline_access api.connectors.read api.connectors.invoke";
/** Refresh an access token when it has < this many seconds left. */
export const REFRESH_LEEWAY_SECONDS = 300;

// ---------------------------------------------------------------------------
// PKCE (RFC 7636).
// ---------------------------------------------------------------------------

export interface PkcePair {
  /** 43–128 base64url chars, sent on the token exchange. */
  verifier: string;
  /** base64url(SHA256(verifier)), sent on the authorize request. */
  challenge: string;
  method: "S256";
}

/**
 * Generate a fresh PKCE verifier + S256 challenge. Each call returns an
 * independent pair; the verifier must be kept secret and reused on the
 * token exchange.
 */
export function generatePkcePair(): PkcePair {
  // 32 random bytes → 43-char base64url (no padding). RFC 7636 §4.1
  // requires 43–128 chars; 32 bytes is the smallest size that still
  // gives ~256 bits of entropy.
  const verifier = base64urlNoPad(randomBytes(32));
  const challenge = base64urlNoPad(createHash("sha256").update(verifier).digest());
  return { verifier, challenge, method: "S256" };
}

function base64urlNoPad(buf: Buffer | Uint8Array): string {
  return Buffer.from(buf)
    .toString("base64")
    .replace(/=+$/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

// ---------------------------------------------------------------------------
// Authorize URL.
// ---------------------------------------------------------------------------

export interface AuthorizeUrlInput {
  clientId: string;
  redirectUri: string;
  state: string;
  codeChallenge: string;
  scope?: string;
  extraParams?: Record<string, string>;
}

/**
 * Build the `https://auth.openai.com/oauth/authorize` URL. The extra
 * params (`id_token_add_organizations=true`, `codex_cli_simplified_flow=true`)
 * are required by the Codex public client — without them the consent
 * page either errors out or refuses the offline_access scope.
 */
export function buildAuthorizeUrl(input: AuthorizeUrlInput): string {
  const url = new URL("/oauth/authorize", CHATGPT_AUTH_BASE);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("client_id", input.clientId);
  url.searchParams.set("redirect_uri", input.redirectUri);
  url.searchParams.set("state", input.state);
  url.searchParams.set("code_challenge", input.codeChallenge);
  url.searchParams.set("code_challenge_method", "S256");
  url.searchParams.set("scope", input.scope ?? DEFAULT_OAUTH_SCOPE);
  url.searchParams.set("id_token_add_organizations", "true");
  url.searchParams.set("codex_cli_simplified_flow", "true");
  for (const [k, v] of Object.entries(input.extraParams ?? {})) {
    url.searchParams.set(k, v);
  }
  return url.toString();
}

// ---------------------------------------------------------------------------
// Token response parsing.
// ---------------------------------------------------------------------------

/** Raw shape returned by `POST https://auth.openai.com/oauth/token`. */
export interface ChatGPTTokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  id_token?: string;
  token_type?: string;
  scope?: string;
}

export interface ParsedToken {
  accessToken: string;
  refreshToken?: string;
  expiresIn: number;
  idToken?: string;
}

/**
 * Normalise the token response. The token endpoint may omit
 * `refresh_token` on subsequent refreshes (RFC 6749 §6) — we tolerate
 * that so the same shape works for both flows.
 */
export function parseTokenResponse(
  body: ChatGPTTokenResponse,
  idTokenOverride?: string,
): ParsedToken {
  return {
    accessToken: body.access_token,
    refreshToken: body.refresh_token,
    expiresIn: body.expires_in,
    idToken: body.id_token ?? idTokenOverride,
  };
}

// ---------------------------------------------------------------------------
// Expiry / refresh math (pure — pass `now` explicitly so tests stay
// deterministic).
// ---------------------------------------------------------------------------

/** Absolute expiry timestamp (ms since epoch) given `expires_in` seconds. */
export function computeExpiresAt(now: number, expiresInSeconds: number): number {
  return now + expiresInSeconds * 1000;
}

/** True when `now > expiresAt` (boundary exclusive — token still valid for one tick). */
export function isTokenExpired(now: number, expiresAt: number): boolean {
  return now > expiresAt;
}

/**
 * True when the token will expire within `REFRESH_LEEWAY_SECONDS` (5 min),
 * mirroring opencode #3281: refresh proactively before expiry rather than
 * waiting for the next request to fail.
 */
export function needsRefresh(now: number, expiresAt: number): boolean {
  return expiresAt - now < REFRESH_LEEWAY_SECONDS * 1000;
}

/**
 * Pull `chatgpt_account_id` out of the unverified id_token JWT payload.
 *
 * Per the OpenAI Codex JWT claim shape observed in opencode #3281, the
 * account id lives at `claims["https://api.openai.com/auth"].chatgpt_account_id`.
 * We do NOT verify the signature here — the token came straight from
 * `https://auth.openai.com/oauth/token` over TLS and we only read the
 * claim to populate the `ChatGPT-Account-Id` header on API calls.
 *
 * Returns `undefined` if the payload is missing or malformed; the caller
 * should then surface a reconnect prompt.
 */
export function extractAccountIdFromIdToken(idToken: string): string | undefined {
  const parts = idToken.split(".");
  if (parts.length !== 3) return undefined;
  try {
    const payload = JSON.parse(Buffer.from(toStandardB64(parts[1]), "base64").toString("utf8"));
    const auth = payload["https://api.openai.com/auth"];
    if (auth && typeof auth === "object" && typeof auth.chatgpt_account_id === "string") {
      return auth.chatgpt_account_id;
    }
    return undefined;
  } catch {
    return undefined;
  }
}

function toStandardB64(s: string): string {
  // base64url → base64: replace chars and re-pad.
  return s.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat((4 - (s.length % 4)) % 4);
}
