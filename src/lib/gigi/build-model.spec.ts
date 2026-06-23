// TDD tests for src/lib/gigi/build-model.ts

import { test } from "node:test";
import assert from "node:assert/strict";
import { buildGigiModel } from "./build-model";

test("returns null when no provider is configured", async () => {
  assert.equal(await buildGigiModel({}), null);
});

test("returns mock model when GIGI_MOCK=1", async () => {
  const result = await buildGigiModel({ GIGI_MOCK: "1" });
  assert.ok(result);
  assert.equal(result.provider.name, "mock");
  assert.equal((result.model as { provider: string }).provider, "gigi-mock");
});

test("returns OpenAI model when OPENAI_API_KEY is set", async () => {
  const result = await buildGigiModel({ OPENAI_API_KEY: "sk-test" });
  assert.ok(result);
  assert.equal(result.provider.name, "openai");
  assert.equal((result.model as { modelId: string }).modelId, "gpt-4o-mini");
});

test("returns Azure model when AZURE_* env is set", async () => {
  const result = await buildGigiModel({
    AZURE_OPENAI_ENDPOINT: "https://x.openai.azure.com",
    AZURE_OPENAI_DEPLOYMENT: "gpt4",
    AZURE_OPENAI_API_KEY: "test-key",
  });
  assert.ok(result);
  assert.equal(result.provider.name, "azure");
  assert.equal((result.model as { modelId: string }).modelId, "gpt4");
});

test("GIGI_PROVIDER=mock overrides everything else", async () => {
  const result = await buildGigiModel({ GIGI_PROVIDER: "mock", OPENAI_API_KEY: "sk-test" });
  assert.ok(result);
  assert.equal(result.provider.name, "mock");
  assert.equal((result.model as { provider: string }).provider, "gigi-mock");
});

test("auto-picks chatgpt when store has a non-expired token and no OPENAI_API_KEY", async () => {
  const future = Date.now() + 60 * 60 * 1000;
  const result = await buildGigiModel(
    {},
    {
      storedToken: {
        accessToken: "at",
        refreshToken: "rt",
        expiresAt: future,
        accountId: "acc-1",
      },
    },
  );
  assert.ok(result);
  assert.equal(result.provider.name, "chatgpt");
  assert.equal(result.provider.model, "gpt-5");
});

test("OPENAI_API_KEY wins over a valid chatgpt token (explicit keys take precedence)", async () => {
  const future = Date.now() + 60 * 60 * 1000;
  const result = await buildGigiModel(
    { OPENAI_API_KEY: "sk-test" },
    {
      storedToken: {
        accessToken: "at",
        expiresAt: future,
        accountId: "acc-1",
      },
    },
  );
  assert.ok(result);
  assert.equal(result.provider.name, "openai");
});

test("GIGI_PROVIDER=chatgpt forces chatgpt even without a token (returns null without one)", async () => {
  // No storedToken provided → forced chatgpt cannot be built.
  const result = await buildGigiModel({ GIGI_PROVIDER: "chatgpt" });
  assert.equal(result, null);
});

test("GIGI_PROVIDER=chatgpt uses the stored token when present", async () => {
  const future = Date.now() + 60 * 60 * 1000;
  const result = await buildGigiModel(
    { GIGI_PROVIDER: "chatgpt" },
    {
      storedToken: {
        accessToken: "at",
        expiresAt: future,
        accountId: "acc-1",
      },
    },
  );
  assert.ok(result);
  assert.equal(result.provider.name, "chatgpt");
});
