// Gigi — model builder.
//
// Single entry point used by `src/routes/api/chat.ts` and tests. Reads the
// resolver to find which provider the user wants, then dispatches to the
// right provider factory. Returns `null` when nothing is configured so
// the chat route can return a 503 instead of crashing.
//
// ASYNC: the "chatgpt" provider needs to (a) decrypt the OAuth token from
// the encrypted settings store and (b) possibly refresh it inline if it's
// about to expire. Both are I/O, so the whole function is async.
import "@tanstack/react-start/server-only";

import { resolveGigiProvider, type GigiProviderInfo } from "./resolver";
import { buildOpenAIModel } from "./providers/openai";
import { buildAzureModel } from "./providers/azure";
import { buildLovableModel } from "./providers/lovable";
import { buildChatGPTModel } from "./providers/chatgpt";
import { createGigiMockModel } from "./mock-provider";
import { type StoredToken, getFreshStoredToken } from "./oauth-chatgpt.server";

export interface BuildGigiResult {
  /** Provider label suitable for surfacing in UI / logs. */
  provider: GigiProviderInfo;
  /** An AI SDK v3 language model (streamable via `streamText`). */
  model: unknown;
}

export interface BuildGigiOptions {
  /**
   * Pre-loaded OAuth token for the chatgpt provider. Tests pass this
   * explicitly; the chat route can leave it undefined and we'll read it
   * from the encrypted settings store. We don't perform the OAuth refresh
   * here (the auth callback and a future scheduled task will); if the
   * stored token is past its expiry we fall through to the next provider
   * (or return `null`).
   */
  storedToken?: StoredToken;
}

/**
 * Build a Gigi model from environment (and optionally the OAuth store),
 * or `null` when nothing is configured.
 *
 * Precedence for the chatgpt provider:
 *   - `GIGI_PROVIDER=chatgpt` forces it (caller must supply a usable token).
 *   - Otherwise, an env-only provider (azure/openai/lovable/ollama/mock) wins.
 *   - As a fallback, if no env provider applies AND a valid stored OAuth
 *     token exists, auto-pick chatgpt.
 */
export async function buildGigiModel(
  env: NodeJS.ProcessEnv = process.env,
  options: BuildGigiOptions = {},
): Promise<BuildGigiResult | null> {
  const info = resolveGigiProvider(env);
  if (!info) {
    // No env-only provider. Try to auto-pick chatgpt from the stored token.
    return tryBuildChatGPTFromStore(env, options);
  }

  switch (info.name) {
    case "mock":
      return { provider: info, model: createGigiMockModel() };
    case "openai":
      return { provider: info, model: buildOpenAIModel(env) };
    case "azure":
      return { provider: info, model: buildAzureModel(env) };
    case "lovable":
      return { provider: info, model: buildLovableModel(env) };
    case "ollama":
      // Ollama is wired in the resolver but the chat.ts handler currently
      // doesn't have a server-side gateway for it — return null so the
      // 503 path fires (and the user sees "ollama not wired" in the
      // notConfiguredMessage hint).
      return null;
    case "chatgpt":
      return tryBuildChatGPTFromStore(env, options);
  }
}

/**
 * Try to build a chatgpt model from the OAuth store. Used both for
 * `GIGI_PROVIDER=chatgpt` (forced) and for the implicit auto-pick when
 * no env provider applies.
 *
 * Returns `null` when no token, when the token is past expiry and has
 * no refresh token, or when the model factory rejects the credentials.
 */
async function tryBuildChatGPTFromStore(
  env: NodeJS.ProcessEnv,
  options: BuildGigiOptions,
): Promise<BuildGigiResult | null> {
  // `getFreshStoredToken` refreshes inline when the token is past expiry
  // or within the 5-min leeway (and has a refresh_token). It also clears
  // the stored blob on refresh failure so the next call surfaces a
  // clean reconnect state. Returns `undefined` for "no token at all" or
  // "expired and no refresh_token" — both surface as a 503 with the
  // existing `notConfiguredMessage` hint.
  //
  // `options.storedToken` (used by tests) bypasses the DB read but still
  // goes through the same refresh-or-not decision in production callers.
  const token = options.storedToken ?? (await getFreshStoredToken());
  if (!token) return null;
  const info: GigiProviderInfo = {
    name: "chatgpt",
    model: env.GIGI_CHATGPT_MODEL?.trim() || "gpt-5",
    label: "ChatGPT",
  };
  const model = buildChatGPTModel({
    accessToken: token.accessToken,
    accountId: token.accountId,
    model: info.model,
  });
  if (!model) return null; // missing required fields
  return { provider: info, model };
}
