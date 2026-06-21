// TDD tests for src/lib/gigi/providers/azure.ts

import { test } from "node:test";
import assert from "node:assert/strict";
import { buildAzureModel } from "./azure";

test("returns null when endpoint is missing", () => {
  assert.equal(buildAzureModel({}), null);
});

test("returns null when deployment is missing", () => {
  assert.equal(buildAzureModel({ AZURE_OPENAI_ENDPOINT: "https://x.openai.azure.com" }), null);
});

test("returns null when API key is missing", () => {
  assert.equal(
    buildAzureModel({
      AZURE_OPENAI_ENDPOINT: "https://x.openai.azure.com",
      AZURE_OPENAI_DEPLOYMENT: "gpt4",
    }),
    null,
  );
});

test("returns a model when endpoint + deployment + api key are set", () => {
  const m = buildAzureModel({
    AZURE_OPENAI_ENDPOINT: "https://x.openai.azure.com",
    AZURE_OPENAI_DEPLOYMENT: "gpt4",
    AZURE_OPENAI_API_KEY: "test-key",
  });
  assert.ok(m, "expected a model");
  // AI SDK models carry a `modelId` property.
  assert.equal((m as { modelId: string }).modelId, "gpt4");
});
