// Gigi — OpenAI provider.
//
// Builds an OpenAI chat model via @ai-sdk/openai-compatible. We use the
// compatible shim (not @ai-sdk/openai) so the code shape matches Azure
// and Ollama — one provider factory, three configs.

import { createOpenAICompatible } from "@ai-sdk/openai-compatible";

export interface OpenAIModelEnv {
  OPENAI_API_KEY?: string;
  OPENAI_MODEL?: string;
}

const DEFAULT_MODEL = "gpt-4o-mini";

/** Build an OpenAI model, or `null` when the key is missing. */
export function buildOpenAIModel(env: OpenAIModelEnv = process.env) {
  const apiKey = env.OPENAI_API_KEY?.trim();
  if (!apiKey) return null;
  const model = env.OPENAI_MODEL?.trim() || DEFAULT_MODEL;
  const provider = createOpenAICompatible({
    name: "openai",
    baseURL: "https://api.openai.com/v1",
    headers: { Authorization: `Bearer ${apiKey}` },
  });
  return provider(model);
}
