import { test } from "node:test";
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";

// Force the env var before importing the module under test.
const KEY = randomBytes(32).toString("base64");
process.env.AGATA_SECRETS_KEY = KEY;

const { encryptSecret, decryptSecret } = await import("./secrets-store.server");

test("round-trips an arbitrary payload", () => {
  const blob = encryptSecret({ hello: "world", n: 42 });
  assert.equal(typeof blob, "string");
  const parts = blob.split(":");
  assert.equal(parts.length, 3);
  assert.deepEqual(decryptSecret(blob), { hello: "world", n: 42 });
});

test("two encryptions of the same payload produce different ciphertexts (random IV)", () => {
  const a = encryptSecret({ x: 1 });
  const b = encryptSecret({ x: 1 });
  assert.notEqual(a, b);
});

test("tampered ciphertext throws", () => {
  const blob = encryptSecret({ ok: true });
  // flip a character in the last segment
  const tampered = blob.slice(0, -1) + (blob.endsWith("a") ? "b" : "a");
  assert.throws(() => decryptSecret(tampered));
});

test("malformed blob throws", () => {
  assert.throws(() => decryptSecret("not-a-blob"), /invalid encrypted secret format/);
});

test("missing AGATA_SECRETS_KEY throws with a hint", async () => {
  const saved = process.env.AGATA_SECRETS_KEY;
  delete process.env.AGATA_SECRETS_KEY;
  // re-import to pick up the env-less state via the cache-busting trick
  const mod = await import(`./secrets-store.server?missing=${Date.now()}`);
  try {
    assert.throws(() => mod.encryptSecret({ x: 1 }), /AGATA_SECRETS_KEY/);
  } finally {
    process.env.AGATA_SECRETS_KEY = saved;
  }
});

test("wrong-length key throws with a hint", () => {
  const saved = process.env.AGATA_SECRETS_KEY!;
  process.env.AGATA_SECRETS_KEY = "tooshort";
  try {
    assert.throws(() => encryptSecret({ x: 1 }), /AGATA_SECRETS_KEY/);
  } finally {
    process.env.AGATA_SECRETS_KEY = saved;
  }
});
