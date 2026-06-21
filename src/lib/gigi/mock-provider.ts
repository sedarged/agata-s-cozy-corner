// Gigi — mock provider.
//
// Deterministic, dependency-free streaming provider for tests, CI, and
// development without burning API credits. Echoes the last user message in
// a friendly Gigi-style Polish response so the full UI streaming path is
// exercised end-to-end.

import { MockLanguageModelV3, simulateReadableStream } from "ai/test";
import type {
  LanguageModelV3CallOptions,
  LanguageModelV3FinishReason,
  LanguageModelV3GenerateResult,
  LanguageModelV3StreamPart,
  LanguageModelV3StreamResult,
  LanguageModelV3Usage,
} from "@ai-sdk/provider";

/**
 * Extract the last user text from a v3 prompt.
 *
 * In v6 the AI SDK passes `prompt` as `Array<{role, content: Array<{type, text} | ...>}>`,
 * not the `messages: Array<{role, content: string}>` shape from older versions.
 * We look for the last `text` part in the last `user` message.
 */
function extractLastUserText(prompt: LanguageModelV3CallOptions["prompt"]): string {
  for (let i = prompt.length - 1; i >= 0; i--) {
    const m = prompt[i];
    if (m.role !== "user") continue;
    const content = m.content;
    if (typeof content === "string") return content;
    if (Array.isArray(content)) {
      for (let j = content.length - 1; j >= 0; j--) {
        const part = content[j] as { type?: string; text?: unknown };
        if (part?.type === "text" && typeof part.text === "string") {
          return part.text;
        }
      }
    }
    return "(pusta wiadomość)";
  }
  return "(pusta wiadomość)";
}

const REPLY_PREFIX = "Cześć, tu Gigi (tryb testowy). Napisałaś: „";
const REPLY_MIDDLE = '".\n\n';
const REPLY_SUFFIX =
  "W produkcji odpowiedziałabym korzystając z Twojej biblioteki i notatek. Tutaj tylko potwierdzam, że strumieniowanie działa.";

const FINISH_STOP: LanguageModelV3FinishReason = { unified: "stop", raw: "stop" };

function buildUsage(outputLen: number): LanguageModelV3Usage {
  return {
    inputTokens: { total: 12, noCache: 12, cacheRead: 0, cacheWrite: 0 },
    outputTokens: { total: outputLen, text: outputLen, reasoning: 0 },
  };
}

function buildReply(prompt: LanguageModelV3CallOptions["prompt"]): string {
  return `${REPLY_PREFIX}${extractLastUserText(prompt)}${REPLY_MIDDLE}${REPLY_SUFFIX}`;
}

/**
 * Build a deterministic streaming model that echoes the last user message.
 *
 * Emits a proper v6 `text-start` → `text-delta` → `text-end` → `finish`
 * lifecycle so the runner's text accumulator actually captures the reply
 * (without `text-start` the SDK logs "text part 0 not found" and the
 * `result.text` stream comes back empty).
 */
export function createGigiMockModel() {
  return new MockLanguageModelV3({
    provider: "gigi-mock",
    modelId: "gigi-mock-1",
    doGenerate: async ({ prompt }): Promise<LanguageModelV3GenerateResult> => {
      const reply = buildReply(prompt);
      return {
        content: [{ type: "text" as const, text: reply }],
        finishReason: FINISH_STOP,
        usage: buildUsage(reply.length),
        warnings: [],
      };
    },
    doStream: async ({ prompt }): Promise<LanguageModelV3StreamResult> => {
      const reply = buildReply(prompt);
      const chunks: LanguageModelV3StreamPart[] = [
        { type: "text-start", id: "0" },
        { type: "text-delta", id: "0", delta: reply },
        { type: "text-end", id: "0" },
        { type: "finish", finishReason: FINISH_STOP, usage: buildUsage(reply.length) },
      ];
      return {
        stream: simulateReadableStream({ chunks, chunkDelayInMs: 5 }),
      };
    },
  });
}
