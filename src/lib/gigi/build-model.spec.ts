// TDD tests for src/lib/gigi/build-model.ts

import { test, before } from "node:test";
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";

process.env.AGATA_SECRETS_KEY ??= randomBytes(32).toString("base64");

import { _repo } from "@/lib/openai-key-store.server";
import { encryptSecret } from "@/lib/secrets-store.server";
import { buildGigiModel } from "./build-model";

const REAL_BLOB = encryptSecret({ apiKey: "sk-stored_aaaaaaaaaaaaaaaa" });

// Helper: clear-stored (no key) repo.
function mockEmpty() {
  _repo.getSetting = async () => undefined;
  _repo.deleteSetting = async () => {};
}

// Helper: stored-key repo with the real-shape AES blob + a chosen model.
function mockStoredKey(model: string) {
  _repo.getSetting = async <T = unknown>(_key: string): Promise<T | undefined> => {
    if (_key === "agata.openai.apiKey") return REAL_BLOB as unknown as T;
    if (_key === "agata.openai.model") return model as unknown as T;
    return undefined;
  };
  _repo.deleteSetting = async () => {};
}

before(() => {
  // Defensive defaults in case a previous test left a partial mock behind.
  mockEmpty();
});

test("returns null when no provider is configured", async () => {
  mockEmpty();
  try {
    assert.equal(await buildGigiModel({}), null);
  } finally {
    mockEmpty();
  }
});

test("returns mock model when GIGI_MOCK=1", async () => {
  mockEmpty();
  try {
    const result = await buildGigiModel({ GIGI_MOCK: "1" });
    assert.ok(result);
    assert.equal(result.provider.name, "mock");
    assert.equal((result.model as { provider: string }).provider, "gigi-mock");
  } finally {
    mockEmpty();
  }
});

test("returns OpenAI model when OPENAI_API_KEY is set", async () => {
  mockEmpty();
  try {
    const result = await buildGigiModel({ OPENAI_API_KEY: "sk-test" });
    assert.ok(result);
    assert.equal(result.provider.name, "openai");
    assert.equal((result.model as { modelId: string }).modelId, "gpt-5.4-mini");
  } finally {
    mockEmpty();
  }
});

test("returns Azure model when AZURE_* env is set", async () => {
  mockEmpty();
  try {
    const result = await buildGigiModel({
      AZURE_OPENAI_ENDPOINT: "https://x.openai.azure.com",
      AZURE_OPENAI_DEPLOYMENT: "gpt4",
      AZURE_OPENAI_API_KEY: "test-key",
    });
    assert.ok(result);
    assert.equal(result.provider.name, "azure");
    assert.equal((result.model as { modelId: string }).modelId, "gpt4");
  } finally {
    mockEmpty();
  }
});

test("GIGI_PROVIDER=mock overrides everything else", async () => {
  mockEmpty();
  try {
    const result = await buildGigiModel({ GIGI_PROVIDER: "mock", OPENAI_API_KEY: "sk-test" });
    assert.ok(result);
    assert.equal(result.provider.name, "mock");
    assert.equal((result.model as { provider: string }).provider, "gigi-mock");
  } finally {
    mockEmpty();
  }
});

test("OPENAI_API_KEY env wins over a stored key", async () => {
  mockStoredKey("gpt-5");
  try {
    const result = await buildGigiModel({ OPENAI_API_KEY: "sk-env" });
    assert.ok(result);
    assert.equal(result.provider.name, "openai");
    // env default is still whatever OPENAI_MODEL says; we only set OPENAI_API_KEY here.
    assert.equal(result.provider.model, "gpt-5.4-mini");
  } finally {
    mockEmpty();
  }
});

test("auto-picks openai when no env key is set but a stored key exists", async () => {
  mockStoredKey("gpt-5");
  try {
    const result = await buildGigiModel({});
    assert.ok(result, "expected buildGigiModel to pick the stored key");
    assert.equal(result.provider.name, "openai");
    assert.equal(result.provider.model, "gpt-5");
    // buildOpenAIModel should have produced a real model object (not null).
    assert.ok(result.model);
  } finally {
    mockEmpty();
  }
});

test("returns null when no env provider and no stored key", async () => {
  mockEmpty();
  try {
    const result = await buildGigiModel({});
    assert.equal(result, null);
  } finally {
    mockEmpty();
  }
});
