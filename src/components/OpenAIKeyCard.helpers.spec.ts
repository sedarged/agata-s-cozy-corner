import { test } from "node:test";
import assert from "node:assert/strict";
import { classifySaveError, isValidOpenAIKeyShape, maskOpenAIKey } from "./OpenAIKeyCard.helpers";

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

// --- classifySaveError ---
// The mutation RPC throws Error("URL STATUS: BODY"); the server returns
// { error: "missing-encryption-key" } for the AGATA_SECRETS_KEY-missing
// path. The matcher must recognise the structured code anywhere in the
// message, not just at the start.

test("classifySaveError flags missing-encryption-key anywhere in message", () => {
  // What the rpc() helper actually throws in production:
  const err = new Error('/api/openai-key/save 500: {"error":"missing-encryption-key"}');
  const { message } = classifySaveError(err);
  assert.match(message, /AGATA_SECRETS_KEY/);
  assert.match(message, /\/etc\/agata\.env/);
});

test("classifySaveError accepts the bare code (defensive)", () => {
  const err = new Error('{"error":"missing-encryption-key"}');
  const { message } = classifySaveError(err);
  assert.match(message, /AGATA_SECRETS_KEY/);
});

test("classifySaveError does not false-positive on substring collisions", () => {
  // The matcher must recognise the structured JSON code, not the bare
  // substring — otherwise a future error like
  // "missing-encryption-key-not-set" would silently hit the hint path.
  const { message: m1 } = classifySaveError(new Error("missing-encryption-key-not-set"));
  assert.equal(m1, "Nie udało się zapisać klucza: missing-encryption-key-not-set");
  const { message: m2 } = classifySaveError(new Error("totally missing-encryption-key-ish"));
  assert.equal(m2, "Nie udało się zapisać klucza: totally missing-encryption-key-ish");
});

test("classifySaveError falls through to a generic message otherwise", () => {
  const err = new Error("network down");
  const { message } = classifySaveError(err);
  assert.equal(message, "Nie udało się zapisać klucza: network down");
});

test("classifySaveError handles non-Error throws", () => {
  const { message } = classifySaveError("just a string");
  assert.equal(message, "Nie udało się zapisać klucza: just a string");
});
