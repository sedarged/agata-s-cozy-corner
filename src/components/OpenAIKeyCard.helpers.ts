// Agata — pure helpers for `OpenAIKeyCard`.
//
// `maskOpenAIKey` is what we show in the UI when the key is already
// saved (the full key is never returned from the server). The format
// mirrors what users see in the OpenAI dashboard: a short prefix + … +
// last few chars.
//
// `isValidOpenAIKeyShape` is the client-side gate for the "Zapisz"
// button — it must stay in lockstep with `OpenAIKeyInputSchema` so the
// button doesn't enable an input the server will reject.

const OPENAI_KEY_REGEX = /^sk-(proj-)?[A-Za-z0-9_-]+$/;

export function maskOpenAIKey(raw: string): string {
  if (!raw || raw.length < 11) return "";
  return raw.slice(0, 7) + "_…" + raw.slice(-4);
}

export function isValidOpenAIKeyShape(raw: string): boolean {
  if (!raw) return false;
  const trimmed = raw.trim();
  if (trimmed.length < 20 || trimmed.length > 256) return false;
  return OPENAI_KEY_REGEX.test(trimmed);
}

/**
 * Map a thrown save-mutation error to a user-facing toast. The mutation
 * RPC prefixes the server body with `"/api/openai-key/save 500: …"`, so
 * a `startsWith("missing-encryption-key")` check misses every real
 * response. Match on `includes` against the structured error code that
 * `/api/openai-key/save` emits.
 */
export function classifySaveError(err: unknown): { message: string } {
  const raw = err instanceof Error ? err.message : String(err);
  // The mutation RPC throws Error("URL STATUS: BODY"); the server emits
  // { "error": "missing-encryption-key" }. Match the structured JSON
  // code, not a bare substring, so a message like
  // "missing-encryption-key-not-set" can't false-positive.
  const MISSING_KEY_BODY = /\{\s*"error"\s*:\s*"missing-encryption-key"\s*\}/;
  if (MISSING_KEY_BODY.test(raw)) {
    return {
      message: "Serwer nie ma skonfigurowanego AGATA_SECRETS_KEY — patrz /etc/agata.env.",
    };
  }
  return { message: `Nie udało się zapisać klucza: ${raw}` };
}
