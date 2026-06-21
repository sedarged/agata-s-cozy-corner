// TDD tests for src/lib/gigi/build-model.ts

import { test } from "node:test";
import assert from "node:assert/strict";
import { buildGigiModel } from "./build-model";

test("returns null when no provider is configured", () => {
  assert.equal(buildGigiModel({}), null);
});

test("returns mock model when GIGI_MOCK=1", () => {
  const result = buildGigiModel({ GIGI_MOCK: "1" });
  assert.ok(result);
  assert.equal(result.provider.name, "mock");
  assert.equal((result.model as { provider: string }).provider, "gigi-mock");
});

test("returns OpenAI model when OPENAI_API_KEY is set", () => {
  const result = buildGigiModel({ OPENAI_API_KEY: "sk-test" });
  assert.ok(result);
  assert.equal(result.provider.name, "openai");
  assert.equal((result.model as { modelId: string }).modelId, "gpt-4o-mini");
});

test("returns Azure model when AZURE_* env is set", () => {
  const result = buildGigiModel({
    AZURE_OPENAI_ENDPOINT: "https://x.openai.azure.com",
    AZURE_OPENAI_DEPLOYMENT: "gpt4",
    AZURE_OPENAI_API_KEY: "test-key",
  });
  assert.ok(result);
  assert.equal(result.provider.name, "azure");
  assert.equal((result.model as { modelId: string }).modelId, "gpt4");
});

test("GIGI_PROVIDER=mock overrides everything else", () => {
  const result = buildGigiModel({ GIGI_PROVIDER: "mock", OPENAI_API_KEY: "sk-test" });
  assert.ok(result);
  assert.equal(result.provider.name, "mock");
  assert.equal((result.model as { provider: string }).provider, "gigi-mock");
});
