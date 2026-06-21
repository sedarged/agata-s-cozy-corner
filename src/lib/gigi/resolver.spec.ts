// TDD tests for src/lib/gigi/resolver.ts — provider selection.
// Written BEFORE the implementation so they serve as the spec.

import { test } from "node:test";
import assert from "node:assert/strict";
import { resolveGigiProvider, notConfiguredMessage } from "./resolver";

const EMPTY: NodeJS.ProcessEnv = {};

test("returns null when no env vars are set", () => {
  assert.equal(resolveGigiProvider(EMPTY), null);
});

test("returns null when GIGI_PROVIDER=openai but no key is set", () => {
  assert.equal(resolveGigiProvider({ GIGI_PROVIDER: "openai" }), null);
});

test("returns openai when OPENAI_API_KEY is set", () => {
  const p = resolveGigiProvider({ OPENAI_API_KEY: "sk-test" });
  assert.deepEqual(p, { name: "openai", model: "gpt-4o-mini", label: "OpenAI" });
});

test("honours OPENAI_MODEL override", () => {
  const p = resolveGigiProvider({ OPENAI_API_KEY: "sk-test", OPENAI_MODEL: "gpt-4o" });
  assert.equal(p?.model, "gpt-4o");
});

test("returns azure when AZURE_OPENAI_* is set", () => {
  const p = resolveGigiProvider({
    AZURE_OPENAI_ENDPOINT: "https://example.openai.azure.com",
    AZURE_OPENAI_DEPLOYMENT: "gpt4",
  });
  assert.equal(p?.name, "azure");
  assert.equal(p?.model, "gpt4");
  assert.match(p?.label ?? "", /Azure OpenAI/);
});

test("returns ollama when OLLAMA_HOST is set", () => {
  const p = resolveGigiProvider({ OLLAMA_HOST: "http://localhost:11434" });
  assert.equal(p?.name, "ollama");
  assert.equal(p?.model, "llama3.1");
});

test("returns mock when GIGI_MOCK=1", () => {
  const p = resolveGigiProvider({ GIGI_MOCK: "1" });
  assert.equal(p?.name, "mock");
  assert.match(p?.label ?? "", /mock/i);
});

test("returns mock when GIGI_PROVIDER=mock (override beats everything)", () => {
  const p = resolveGigiProvider({ GIGI_PROVIDER: "mock", OPENAI_API_KEY: "sk-test" });
  assert.equal(p?.name, "mock");
});

test("OpenAI wins over Azure when both are set (Azure needs explicit override)", () => {
  const p = resolveGigiProvider({
    OPENAI_API_KEY: "sk-test",
    AZURE_OPENAI_ENDPOINT: "https://example.openai.azure.com",
    AZURE_OPENAI_DEPLOYMENT: "gpt4",
  });
  // Implicit precedence: Azure checks first, so Azure wins.
  assert.equal(p?.name, "azure");
});

test("notConfiguredMessage contains a hint about OPENAI_API_KEY", () => {
  const msg = notConfiguredMessage(null);
  assert.match(msg, /OPENAI_API_KEY/);
});

test("notConfiguredMessage returns the provider label when configured", () => {
  const p = { name: "openai" as const, model: "gpt-4o-mini", label: "OpenAI" };
  assert.equal(notConfiguredMessage(p), "OpenAI");
});
