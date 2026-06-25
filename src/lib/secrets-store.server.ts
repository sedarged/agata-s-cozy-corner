// Agata — generic AES-256-GCM encrypt/decrypt for small JSON blobs stored
// in the `settings` table. The encryption key lives in
// `process.env.AGATA_SECRETS_KEY` (32 random bytes, base64).
//
// Output format: `iv:tag:ciphertext`, each segment base64url with no
// padding. 12-byte IV (GCM standard), 16-byte auth tag.
//
// Replaces the previous chatgpt-oauth-specific token store; the encrypt-at-rest
// helper is now generic over the secret payload shape.
import "@tanstack/react-start/server-only";
import { createCipheriv, createDecipheriv, randomBytes, type CipherGCMTypes } from "node:crypto";

const ALGO: CipherGCMTypes = "aes-256-gcm";

function loadKey(): Buffer {
  const k = process.env.AGATA_SECRETS_KEY;
  if (!k) {
    throw new Error(
      "AGATA_SECRETS_KEY is not set. Generate 32 random bytes (base64) and add to /etc/agata.env.",
    );
  }
  const buf = Buffer.from(k, "base64");
  if (buf.length !== 32) {
    throw new Error(
      `AGATA_SECRETS_KEY must decode to exactly 32 bytes (got ${buf.length}). Regenerate with: openssl rand -base64 32`,
    );
  }
  return buf;
}

export function encryptSecret(payload: Record<string, unknown>): string {
  const key = loadKey();
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGO, key, iv);
  const plaintext = Buffer.from(JSON.stringify(payload), "utf8");
  const enc = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [iv.toString("base64url"), tag.toString("base64url"), enc.toString("base64url")].join(":");
}

export function decryptSecret(blob: string): Record<string, unknown> {
  const parts = blob.split(":");
  if (parts.length !== 3) throw new Error("invalid encrypted secret format");
  const [ivPart, tagPart, ctPart] = parts;
  const key = loadKey();
  const iv = Buffer.from(ivPart, "base64url");
  const tag = Buffer.from(tagPart, "base64url");
  const ct = Buffer.from(ctPart, "base64url");
  const decipher = createDecipheriv(ALGO, key, iv);
  decipher.setAuthTag(tag);
  const dec = Buffer.concat([decipher.update(ct), decipher.final()]);
  return JSON.parse(dec.toString("utf8")) as Record<string, unknown>;
}
