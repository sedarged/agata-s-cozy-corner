// TDD tests for src/lib/gigi/providers/openai.ts

import { test } from "node:test";
import assert from "node:assert/strict";
import { buildOpenAIModel } from "./openai";

test("returns null when OPENAI_API_KEY is missing", () => {
  assert.equal(buildOpenAIModel({}), null);
});

test("returns a model when OPENAI_API_KEY is set", () => {
  const m = buildOpenAIModel({ OPENAI_API_KEY: "sk-test" });
  assert.ok(m);
  assert.equal((m as { modelId: string }).modelId, "gpt-4o-mini");
});

test("honours OPENAI_MODEL override", () => {
  const m = buildOpenAIModel({ OPENAI_API_KEY: "sk-test", OPENAI_MODEL: "gpt-4o" });
  assert.equal((m as { modelId: string }).modelId, "gpt-4o");
});
