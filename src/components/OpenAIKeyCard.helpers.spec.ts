import { test } from "node:test";
import assert from "node:assert/strict";
import { isValidOpenAIKeyShape, maskOpenAIKey } from "./OpenAIKeyCard.helpers";

// Placeholders with underscores so secret-scanners don't flag them.
const KEY_PLAIN = "sk-aaaa_bbbb_cccc_dddd_eeee";
const KEY_PROJ = "sk-proj-aaaa_bbbb_cccc_dddd_eeee";

test("maskOpenAIKey returns first 7 + … + last 4", () => {
  assert.equal(maskOpenAIKey(KEY_PLAIN), "sk-aaaa_…eeee");
});

test("maskOpenAIKey handles sk-proj- prefix", () => {
  assert.equal(maskOpenAIKey(KEY_PROJ), "sk-proj_…eeee");
});

test("maskOpenAIKey returns empty string for empty input", () => {
  assert.equal(maskOpenAIKey(""), "");
});

test("maskOpenAIKey returns empty string for very short input", () => {
  assert.equal(maskOpenAIKey("short"), "");
});

test("isValidOpenAIKeyShape accepts canonical keys", () => {
  assert.equal(isValidOpenAIKeyShape(KEY_PLAIN), true);
  assert.equal(isValidOpenAIKeyShape(KEY_PROJ), true);
});

test("isValidOpenAIKeyShape rejects malformed input", () => {
  assert.equal(isValidOpenAIKeyShape(""), false);
  assert.equal(isValidOpenAIKeyShape("aaaa_bbbb_cccc_dddd_eeee"), false);
  assert.equal(isValidOpenAIKeyShape("sk-short"), false);
});
