// TDD tests for src/lib/gigi/providers/lovable.ts

import { test } from "node:test";
import assert from "node:assert/strict";
import { buildLovableModel } from "./lovable";

test("returns null when LOVABLE_API_KEY is missing", () => {
  assert.equal(buildLovableModel({}), null);
});

test("returns a model when LOVABLE_API_KEY is set", () => {
  const m = buildLovableModel({ LOVABLE_API_KEY: "lov-test" });
  assert.ok(m);
  // Default model id should be the Gemini flash preview the gateway proxies.
  assert.match((m as { modelId: string }).modelId, /gemini|claude|gpt/);
});
