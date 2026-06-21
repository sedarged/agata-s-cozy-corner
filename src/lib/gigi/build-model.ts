// Gigi — model builder.
//
// Single entry point used by `src/routes/api/chat.ts` and tests. Reads the
// resolver to find which provider the user wants, then dispatches to the
// right provider factory. Returns `null` when nothing is configured so
// the chat route can return a 503 instead of crashing.

import { resolveGigiProvider, type GigiProviderInfo } from "./resolver";
import { buildOpenAIModel } from "./providers/openai";
import { buildAzureModel } from "./providers/azure";
import { buildLovableModel } from "./providers/lovable";
import { createGigiMockModel } from "./mock-provider";

export interface BuildGigiResult {
  /** Provider label suitable for surfacing in UI / logs. */
  provider: GigiProviderInfo;
  /** An AI SDK v3 language model (streamable via `streamText`). */
  model: unknown;
}

/**
 * Build a Gigi model from environment, or `null` when nothing is configured.
 *
 * The mock provider has no environment requirements; the others need keys.
 */
export function buildGigiModel(env: NodeJS.ProcessEnv = process.env): BuildGigiResult | null {
  const info = resolveGigiProvider(env);
  if (!info) return null;

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
