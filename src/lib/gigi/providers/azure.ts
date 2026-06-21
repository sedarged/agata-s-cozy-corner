// Gigi — Azure OpenAI provider.
//
// Builds an Azure OpenAI chat model via @ai-sdk/openai-compatible so we can
// hit the deployment URL + api-key (or Entra ID bearer) flow without pulling
// in @ai-sdk/openai (which targets the public OpenAI endpoint and ignores
// `AZURE_OPENAI_ENDPOINT`).

import { createOpenAICompatible } from "@ai-sdk/openai-compatible";

export interface AzureModelEnv {
  AZURE_OPENAI_ENDPOINT?: string;
  AZURE_OPENAI_DEPLOYMENT?: string;
  /** API key OR Entra ID bearer token. Azure also accepts `api-key` header. */
  AZURE_OPENAI_API_KEY?: string;
  /** Optional API version override; defaults to a stable 2024-08-01-preview. */
  AZURE_OPENAI_API_VERSION?: string;
}

/**
 * Build an Azure OpenAI model, or `null` when any required setting is missing.
 *
 * Endpoint is normalised to strip trailing slashes so callers can paste the
 * value from the Azure portal without surprises.
 */
export function buildAzureModel(env: AzureModelEnv = process.env) {
  const endpoint = env.AZURE_OPENAI_ENDPOINT?.trim().replace(/\/+$/, "");
  const deployment = env.AZURE_OPENAI_DEPLOYMENT?.trim();
  const apiKey = env.AZURE_OPENAI_API_KEY?.trim();
  if (!endpoint || !deployment || !apiKey) return null;

  const version = env.AZURE_OPENAI_API_VERSION?.trim() || "2024-08-01-preview";
  const provider = createOpenAICompatible({
    name: "azure-openai",
    baseURL: `${endpoint}/openai/deployments/${deployment}`,
    headers: {
      "api-key": apiKey,
    },
    queryParams: { "api-version": version },
  });

  return provider(deployment);
}
