import { test } from "node:test";
import assert from "node:assert/strict";
import { OpenAIKeyInputSchema } from "./schemas";

// 24-char placeholder; underscores keep the secret-scanner quiet.
const VALID = "sk-aaaa_bbbb_cccc_dddd_eeee";
const VALID_PROJ = "sk-proj-aaaa_bbbb_cccc_dddd";

test("accepts canonical sk- key with valid model", () => {
  const r = OpenAIKeyInputSchema.safeParse({ apiKey: VALID, model: "gpt-5.4-mini" });
  assert.equal(r.success, true);
});

test("accepts sk-proj- key with valid model", () => {
  const r = OpenAIKeyInputSchema.safeParse({ apiKey: VALID_PROJ, model: "gpt-5" });
  assert.equal(r.success, true);
});

test("rejects too-short key", () => {
  const r = OpenAIKeyInputSchema.safeParse({ apiKey: "sk-short", model: "gpt-5.4-mini" });
  assert.equal(r.success, false);
  if (!r.success) assert.match(r.error.issues[0].message, /za krótki/);
});

test("rejects too-long key", () => {
  const long = "sk-" + "a".repeat(260);
  const r = OpenAIKeyInputSchema.safeParse({ apiKey: long, model: "gpt-5.4-mini" });
  assert.equal(r.success, false);
});

test("rejects malformed key (no prefix)", () => {
  const r = OpenAIKeyInputSchema.safeParse({
    apiKey: "aaaa_bbbb_cccc_dddd_eeee",
    model: "gpt-5.4-mini",
  });
  assert.equal(r.success, false);
});

test("rejects unknown model", () => {
  const r = OpenAIKeyInputSchema.safeParse({ apiKey: VALID, model: "gpt-99" });
  assert.equal(r.success, false);
});

test("trims whitespace around the key", () => {
  const r = OpenAIKeyInputSchema.safeParse({ apiKey: "  " + VALID + "  ", model: "gpt-5.4-mini" });
  assert.equal(r.success, true);
  if (r.success) assert.equal(r.data.apiKey, VALID);
});
