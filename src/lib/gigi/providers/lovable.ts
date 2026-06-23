// Gigi — Lovable AI gateway provider.
//
// Wraps `createLovableAiGatewayProvider` so the rest of the app uses the
// same `buildXxxModel(env) → unknown` shape as openai / azure / mock.
//
// Kept here (not in `@/lib/ai-gateway.server.ts`) so the Gigi provider
// surface is self-contained and testable.

import { createLovableAiGatewayProvider } from "@/lib/ai-gateway.server";

export interface LovableModelEnv {
  LOVABLE_API_KEY?: string;
  /** Default: google/gemini-3-flash-preview (the gateway's cheapest fast model). */
  LOVABLE_MODEL?: string;
}

const DEFAULT_MODEL = "google/gemini-3-flash-preview";

export function buildLovableModel(env: LovableModelEnv = process.env) {
  const key = env.LOVABLE_API_KEY?.trim();
  if (!key) return null;
  const model = env.LOVABLE_MODEL?.trim() || DEFAULT_MODEL;
  return createLovableAiGatewayProvider(key)(model);
}
