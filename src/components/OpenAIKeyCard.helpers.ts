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
