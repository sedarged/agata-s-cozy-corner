// Gigi — model builder.
//
// Single entry point used by `src/routes/api/chat.ts` and tests. Reads the
// resolver to find which provider the user wants, then dispatches to the
// right provider factory. Returns `null` when nothing is configured so
// the chat route can return a 503 instead of crashing.
//
// ASYNC: the auto-pick-from-store path needs to read the encrypted OpenAI
// key from the settings table, which is I/O, so the whole function is async.
import "@tanstack/react-start/server-only";

import { resolveGigiProvider, type GigiProviderInfo } from "./resolver";
import { buildOpenAIModel } from "./providers/openai";
import { buildAzureModel } from "./providers/azure";
import { buildLovableModel } from "./providers/lovable";
import { createGigiMockModel } from "./mock-provider";
import { getStoredOpenAIKey } from "@/lib/openai-key-store.server";

export interface BuildGigiResult {
  /** Provider label suitable for surfacing in UI / logs. */
  provider: GigiProviderInfo;
  /** An AI SDK v3 language model (streamable via `streamText`). */
  model: unknown;
}

/**
 * Build a Gigi model from environment (and the encrypted OpenAI key store
 * as a fallback), or `null` when nothing is configured.
 *
 * Precedence:
 *   - env-only providers (azure / openai / lovable / ollama / mock) win.
 *   - If none apply, auto-pick OpenAI from the encrypted settings store so
 *     the user can drive Gigi from the Settings UI without touching env.
 */
export async function buildGigiModel(
  env: NodeJS.ProcessEnv = process.env,
): Promise<BuildGigiResult | null> {
  const info = resolveGigiProvider(env);
  if (info) {
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
    }
  }

  // No env-only provider. Try to auto-pick from the encrypted UI key.
  return tryBuildOpenAIFromStore(env);
}

/**
 * Auto-pick OpenAI when no env provider applies AND the user has saved
 * a key in Settings (encrypted in the `settings` table). The stored
 * model is honoured so the dropdown choice persists across restarts.
 */
async function tryBuildOpenAIFromStore(env: NodeJS.ProcessEnv): Promise<BuildGigiResult | null> {
  const stored = await getStoredOpenAIKey();
  if (!stored) return null;
  const info: GigiProviderInfo = {
    name: "openai",
    model: stored.model,
    label: "OpenAI (z ustawień)",
  };
  const model = buildOpenAIModel({
    OPENAI_API_KEY: stored.apiKey,
    OPENAI_MODEL: stored.model,
  });
  return { provider: info, model };
}
