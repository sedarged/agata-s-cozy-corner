// Gigi — provider resolver.
//
// Selects which AI provider to use based on environment variables. The order
// of precedence is:
//   1. GIGI_PROVIDER (explicit override: "mock" | "openai" | "azure" | "ollama")
//   2. AZURE_OPENAI_* env vars  → "azure"  (OAuth bearer / API-key)
//   3. OPENAI_API_KEY           → "openai"
//   4. OLLAMA_HOST              → "ollama"  (local dev, no key)
//   5. GIGI_MOCK=1              → "mock"    (deterministic, for tests / CI)
//   6. otherwise → null  (caller returns 503 "not configured")
//
// `mock` is always last by default so a real key in env wins. Set
// GIGI_PROVIDER=mock to force it (used by tests and by `/gigi` smoke flows
// when no key is configured).

export type GigiProviderName = "mock" | "openai" | "azure" | "ollama" | "lovable";

export interface GigiProviderInfo {
  name: GigiProviderName;
  model: string;
  /** A short human-readable label suitable for surfacing in the UI / logs. */
  label: string;
}

/**
 * Resolve the active provider based purely on `process.env`. Pure function
 * so it can be unit-tested without booting the full server.
 */
export function resolveGigiProvider(env: NodeJS.ProcessEnv = process.env): GigiProviderInfo | null {
  const explicit = env.GIGI_PROVIDER?.trim().toLowerCase();
  if (explicit === "mock") return { name: "mock", model: "mock-1", label: "Tryb testowy (mock)" };
  if (explicit === "openai") {
    if (!env.OPENAI_API_KEY) return null;
    return { name: "openai", model: env.OPENAI_MODEL?.trim() || "gpt-4o-mini", label: "OpenAI" };
  }
  if (explicit === "azure") {
    if (!env.AZURE_OPENAI_ENDPOINT || !env.AZURE_OPENAI_DEPLOYMENT) return null;
    return {
      name: "azure",
      model: env.AZURE_OPENAI_DEPLOYMENT,
      label: `Azure OpenAI · ${env.AZURE_OPENAI_DEPLOYMENT}`,
    };
  }
  if (explicit === "ollama") {
    return {
      name: "ollama",
      model: env.OLLAMA_MODEL?.trim() || "llama3.1",
      label: `Ollama · ${env.OLLAMA_MODEL?.trim() || "llama3.1"}`,
    };
  }
  if (explicit === "lovable") {
    if (!env.LOVABLE_API_KEY) return null;
    return {
      name: "lovable",
      model: env.LOVABLE_MODEL?.trim() || "google/gemini-3-flash-preview",
      label: "Lovable gateway",
    };
  }

  // Implicit precedence when GIGI_PROVIDER is unset.
  if (env.AZURE_OPENAI_ENDPOINT && env.AZURE_OPENAI_DEPLOYMENT) {
    return {
      name: "azure",
      model: env.AZURE_OPENAI_DEPLOYMENT,
      label: `Azure OpenAI · ${env.AZURE_OPENAI_DEPLOYMENT}`,
    };
  }
  if (env.OPENAI_API_KEY) {
    return { name: "openai", model: env.OPENAI_MODEL?.trim() || "gpt-4o-mini", label: "OpenAI" };
  }
  if (env.LOVABLE_API_KEY) {
    return {
      name: "lovable",
      model: env.LOVABLE_MODEL?.trim() || "google/gemini-3-flash-preview",
      label: "Lovable gateway",
    };
  }
  if (env.OLLAMA_HOST) {
    return {
      name: "ollama",
      model: env.OLLAMA_MODEL?.trim() || "llama3.1",
      label: `Ollama · ${env.OLLAMA_MODEL?.trim() || "llama3.1"}`,
    };
  }
  if (env.GIGI_MOCK === "1" || env.GIGI_MOCK === "true") {
    return { name: "mock", model: "mock-1", label: "Tryb testowy (mock)" };
  }
  return null;
}

/**
 * The 503 message shown when no provider is configured. Kept here so tests
 * can pin the exact wording without re-implementing it in chat.ts.
 */
export function notConfiguredMessage(provider: GigiProviderInfo | null): string {
  if (provider) return provider.label;
  return "Gigi nie jest jeszcze skonfigurowana. Ustaw OPENAI_API_KEY, LOVABLE_API_KEY, AZURE_OPENAI_ENDPOINT + AZURE_OPENAI_DEPLOYMENT, lub GIGI_MOCK=1.";
}
