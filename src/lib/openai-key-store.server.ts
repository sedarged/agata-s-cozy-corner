// Agata — server-only OpenAI API key store. Two rows in the `settings`
// table: `agata.openai.apiKey` (encrypted via secrets-store) and
// `agata.openai.model` (plaintext). The model picker persists alongside
// the key so the user doesn't have to re-select after a key rotation.
import "@tanstack/react-start/server-only";

import * as repo from "@/lib/db/repositories/goals";
import { encryptSecret, decryptSecret } from "@/lib/secrets-store.server";
import { OpenAIKeyInputSchema } from "@/lib/api/schemas";

const KEY_KEY = "agata.openai.apiKey";
const MODEL_KEY = "agata.openai.model";

// Indirection so unit tests can swap the settings repo (the ESM module
// namespace is frozen — tests can't reassign named exports, so we hold
// a mutable object inside the module that wraps the real repo).
export const _repo: {
  getSetting: <T = unknown>(key: string) => Promise<T | undefined>;
  setSetting: <T = unknown>(key: string, value: T) => Promise<void>;
  deleteSetting: (key: string) => Promise<void>;
} = {
  getSetting: repo.getSetting.bind(repo),
  setSetting: repo.setSetting.bind(repo),
  deleteSetting: repo.deleteSetting.bind(repo),
};

export interface StoredOpenAIKey {
  apiKey: string;
  model: string;
}

export async function saveOpenAIKey(input: { apiKey: string; model: string }): Promise<void> {
  // Re-validate at the storage boundary — a route that forgot to
  // validate can't poison the store.
  const parsed = OpenAIKeyInputSchema.parse(input);
  const blob = encryptSecret({ apiKey: parsed.apiKey });
  await _repo.setSetting(KEY_KEY, blob);
  await _repo.setSetting(MODEL_KEY, parsed.model);
}

export async function getStoredOpenAIKey(): Promise<StoredOpenAIKey | undefined> {
  const blob = await _repo.getSetting<string>(KEY_KEY);
  const model = await _repo.getSetting<string>(MODEL_KEY);
  if (!blob || !model) return undefined;
  try {
    const payload = decryptSecret(blob);
    if (typeof payload.apiKey !== "string") return undefined;
    return { apiKey: payload.apiKey, model };
  } catch (err) {
    // Distinguish "operator forgot /etc/agata.env AGATA_SECRETS_KEY"
    // (fixable server-side — surface it loudly) from "blob is corrupt
    // or key was rotated" (the user has to re-enter — silent fallback).
    if (err instanceof Error && err.message.startsWith("AGATA_SECRETS_KEY")) throw err;
    return undefined;
  }
}

export async function clearOpenAIKey(): Promise<void> {
  await _repo.deleteSetting(KEY_KEY);
  await _repo.deleteSetting(MODEL_KEY);
}
