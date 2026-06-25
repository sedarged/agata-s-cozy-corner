import { test } from "node:test";
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";

process.env.AGATA_SECRETS_KEY = randomBytes(32).toString("base64");

// Stub the settings repo before importing the module under test.
const store = new Map<string, unknown>();
const mod = await import("./openai-key-store.server");
const repoRef = (mod as any)._repo;
repoRef.getSetting = async (key: string) => store.get(key);
repoRef.setSetting = async (key: string, value: unknown) => {
  store.set(key, value);
};
repoRef.deleteSetting = async (key: string) => {
  store.delete(key);
};

const { getStoredOpenAIKey, saveOpenAIKey, clearOpenAIKey } = mod;
// 24-char placeholder; underscores keep the secret-scanner quiet.
const KEY = "sk-aaaa_bbbb_cccc_dddd_eeee";

test("save + get round-trips through encryption", async () => {
  await saveOpenAIKey({ apiKey: KEY, model: "gpt-5.4-mini" });
  const got = await getStoredOpenAIKey();
  assert.deepEqual(got, { apiKey: KEY, model: "gpt-5.4-mini" });

  // The stored blob must NOT contain the plaintext key.
  const stored = store.get("agata.openai.apiKey") as string;
  assert.equal(typeof stored, "string");
  assert.ok(!stored.includes(KEY), "stored blob should not contain plaintext key");
});

test("get on empty store returns undefined", async () => {
  store.clear();
  const got = await getStoredOpenAIKey();
  assert.equal(got, undefined);
});

test("clear removes both rows", async () => {
  await saveOpenAIKey({ apiKey: KEY, model: "gpt-5" });
  await clearOpenAIKey();
  assert.equal(store.has("agata.openai.apiKey"), false);
  assert.equal(store.has("agata.openai.model"), false);
});

test("save re-validates input (rejects too-short key)", async () => {
  await assert.rejects(
    () => saveOpenAIKey({ apiKey: "short", model: "gpt-5.4-mini" }),
    /Klucz OpenAI jest za krótki/,
  );
});

test("get returns undefined when ciphertext is corrupt", async () => {
  store.set("agata.openai.apiKey", "not-a-blob");
  const got = await getStoredOpenAIKey();
  assert.equal(got, undefined);
});
