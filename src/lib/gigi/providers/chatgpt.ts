// Agata — ChatGPT (Codex OAuth) provider.
//
// Builds an AI SDK v3 language model against the ChatGPT backend API
// (`POST https://chatgpt.com/backend-api/codex/responses`) using the
// openai-compatible shim — the wire shape is identical to OpenAI's
// chat completions (`Authorization: Bearer ...`, JSON SSE), with two
// extra required headers per openai/codex eb8c1ee (chatgpt_client.rs):
//
//   ChatGPT-Account-Id: <id from JWT claim>
//   OAI-Product-Sku:    codex
//
// Tokens are read from the encrypted settings store (see
// `oauth-chatgpt.server.ts`) and passed in by the caller — this module
// is pure (no DB, no env, no fetch) so it can be unit-tested.
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { CHATGPT_API_BASE } from "../oauth-chatgpt";

export interface ChatGPTModelInput {
  /** Bearer token from OAuth token endpoint. */
  accessToken: string;
  /** `chatgpt_account_id` from the JWT — required by the backend. */
  accountId: string;
  /** Override the model id (defaults to the Codex default `gpt-5`). */
  model?: string;
}

const DEFAULT_MODEL = "gpt-5";
const PRODUCT_SKU = "codex";

/**
 * Build a ChatGPT (Codex OAuth) model, or `null` when the required
 * credentials are missing. The two required inputs (token + account id)
 * must come from a previously-completed OAuth flow.
 */
export function buildChatGPTModel(input: ChatGPTModelInput) {
  const accessToken = input.accessToken?.trim();
  const accountId = input.accountId?.trim();
  if (!accessToken || !accountId) return null;
  const modelId = input.model?.trim() || DEFAULT_MODEL;
  const provider = createOpenAICompatible({
    name: "chatgpt",
    baseURL: CHATGPT_API_BASE,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "ChatGPT-Account-Id": accountId,
      "OAI-Product-Sku": PRODUCT_SKU,
    },
  });
  return provider(modelId);
}
