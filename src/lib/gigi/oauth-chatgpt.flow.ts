// Agata — server-only HTTP exchanges for the ChatGPT OAuth flow.
//
// Wraps `fetch` against `https://auth.openai.com/oauth/token`:
//   - exchangeCodeForToken  (grant_type=authorization_code)
//   - refreshAccessToken    (grant_type=refresh_token)
//
// Both return a `ParsedToken` shape compatible with the rest of the
// module. Errors include the response body (truncated) so the user can
// see *why* the provider rejected the request.
import "@tanstack/react-start/server-only";

import {
  CHATGPT_AUTH_BASE,
  type ChatGPTTokenResponse,
  type ParsedToken,
  parseTokenResponse,
} from "./oauth-chatgpt";

const TOKEN_URL = `${CHATGPT_AUTH_BASE}/oauth/token`;

export interface ExchangeCodeInput {
  clientId: string;
  code: string;
  codeVerifier: string;
  redirectUri: string;
}

export interface RefreshInput {
  clientId: string;
  refreshToken: string;
}

/**
 * Exchange an authorization code for a token. Throws on non-2xx with the
 * response body attached for diagnosis.
 */
export async function exchangeCodeForToken(input: ExchangeCodeInput): Promise<ParsedToken> {
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    client_id: input.clientId,
    code: input.code,
    redirect_uri: input.redirectUri,
    code_verifier: input.codeVerifier,
  });
  return postToken(body);
}

/**
 * Refresh an access token using a stored refresh_token. The server may
 * return a fresh refresh_token (rotation) or omit it (RFC 6749 §6).
 */
export async function refreshAccessToken(input: RefreshInput): Promise<ParsedToken> {
  const body = new URLSearchParams({
    grant_type: "refresh_token",
    client_id: input.clientId,
    refresh_token: input.refreshToken,
  });
  return postToken(body);
}

async function postToken(body: URLSearchParams): Promise<ParsedToken> {
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: {
      "content-type": "application/x-www-form-urlencoded",
      accept: "application/json",
    },
    body: body.toString(),
  });
  const text = await res.text();
  if (!res.ok) {
    // Truncate so a giant HTML error page from a reverse proxy doesn't blow up logs.
    const snippet = text.slice(0, 500);
    throw new Error(`ChatGPT token endpoint returned ${res.status}: ${snippet}`);
  }
  let json: ChatGPTTokenResponse;
  try {
    json = JSON.parse(text) as ChatGPTTokenResponse;
  } catch (e) {
    throw new Error(`ChatGPT token endpoint returned non-JSON: ${text.slice(0, 200)}`);
  }
  return parseTokenResponse(json);
}
