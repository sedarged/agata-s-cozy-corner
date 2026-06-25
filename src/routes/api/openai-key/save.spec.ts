// TDD tests for /api/openai-key/save (H2 + H5).
//
// H2: CSRF defense-in-depth. The route rejects POSTs whose Origin doesn't
// match the configured AGATA_PUBLIC_ORIGIN host.
// H5: encrypt path failures must NOT leak the underlying message (which
// can include $DATA_DIR) — only a generic "save-failed" surfaces; the
// specific "missing-encryption-key" branch is preserved so the Settings UI
// hint can still fire.
import { test } from "node:test";
import assert from "node:assert/strict";
import { handleSave, isAllowedOrigin } from "./save";
import { maskOpenAIKey } from "@/components/OpenAIKeyCard.helpers";
import type { z } from "zod";
import { OpenAIKeyInputSchema } from "@/lib/api/schemas";

type OpenAIKeyInput = z.infer<typeof OpenAIKeyInputSchema>;

const VALID: OpenAIKeyInput = { apiKey: "sk-aaaa_bbbb_cccc_dddd_eeee", model: "gpt-5.4-mini" };

function jsonRequest(body: unknown, headers: Record<string, string> = {}): Request {
  return new Request("http://127.0.0.1/api/openai-key/save", {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: JSON.stringify(body),
  });
}

// --- H2 CSRF ---

test("isAllowedOrigin allows when no Origin and no Referer (curl/server-to-server)", () => {
  const req = new Request("http://x", { method: "POST" });
  assert.equal(isAllowedOrigin(req, "mycozylibary.com"), true);
});

test("isAllowedOrigin allows matching Origin", () => {
  const req = new Request("http://x", {
    method: "POST",
    headers: { origin: "https://mycozylibary.com" },
  });
  assert.equal(isAllowedOrigin(req, "mycozylibary.com"), true);
});

test("isAllowedOrigin allows matching Referer", () => {
  const req = new Request("http://x", {
    method: "POST",
    headers: { referer: "https://mycozylibary.com/settings" },
  });
  assert.equal(isAllowedOrigin(req, "mycozylibary.com"), true);
});

test("isAllowedOrigin rejects cross-site Origin", () => {
  const req = new Request("http://x", {
    method: "POST",
    headers: { origin: "https://evil.com" },
  });
  assert.equal(isAllowedOrigin(req, "mycozylibary.com"), false);
});

test("isAllowedOrigin rejects malformed Origin", () => {
  const req = new Request("http://x", {
    method: "POST",
    headers: { origin: "not-a-url" },
  });
  assert.equal(isAllowedOrigin(req, "mycozylibary.com"), false);
});

test("isAllowedOrigin is permissive when allowedOriginHost is null (operator opt-out)", () => {
  const req = new Request("http://x", {
    method: "POST",
    headers: { origin: "https://anything.example" },
  });
  assert.equal(isAllowedOrigin(req, null), true);
});

test("handleSave returns 403 when Origin is cross-site", async () => {
  const res = await handleSave(jsonRequest(VALID, { origin: "https://evil.com" }), {
    allowedOriginHost: "mycozylibary.com",
    saveOpenAIKey: async () => {},
    logError: () => {},
  });
  assert.equal(res.status, 403);
  const body = (await res.json()) as Record<string, unknown>;
  assert.equal(body.error, "forbidden");
});

// --- H5 sanitise save errors ---

test("handleSave returns 500 missing-encryption-key when AGATA_SECRETS_KEY is unset", async () => {
  const res = await handleSave(jsonRequest(VALID), {
    allowedOriginHost: null,
    saveOpenAIKey: async () => {
      throw new Error("AGATA_SECRETS_KEY is not set");
    },
    logError: () => {},
  });
  assert.equal(res.status, 500);
  const body = (await res.json()) as Record<string, unknown>;
  assert.equal(body.error, "missing-encryption-key");
});

test("handleSave returns 500 save-failed (NOT the raw message) when encrypt throws", async () => {
  const res = await handleSave(jsonRequest(VALID), {
    allowedOriginHost: null,
    saveOpenAIKey: async () => {
      // Simulate an ENOENT-like failure with $DATA_DIR in the message.
      throw new Error("ENOENT: /var/lib/agata/secrets/aes.bin: no such file");
    },
    logError: () => {},
  });
  assert.equal(res.status, 500);
  const body = (await res.json()) as Record<string, unknown>;
  assert.equal(body.error, "save-failed");
  // The raw error must not surface in the response body anywhere.
  const json = JSON.stringify(body);
  assert.doesNotMatch(json, /ENOENT/);
  assert.doesNotMatch(json, /var\/lib\/agata/);
});

test("handleSave logs the full error server-side when save fails", async () => {
  const logged: unknown[] = [];
  const boom = new Error("AGATA_SECRETS_KEY is not set");
  await handleSave(jsonRequest(VALID), {
    allowedOriginHost: null,
    saveOpenAIKey: async () => {
      throw boom;
    },
    logError: (err) => logged.push(err),
  });
  assert.equal(logged.length, 1);
  assert.equal(logged[0], boom);
});

// --- happy path ---

test("handleSave returns ok=true + masked key on success", async () => {
  const res = await handleSave(jsonRequest(VALID), {
    allowedOriginHost: null,
    saveOpenAIKey: async () => {},
    logError: () => {},
  });
  assert.equal(res.status, 200);
  const body = (await res.json()) as Record<string, unknown>;
  assert.equal(body.ok, true);
  assert.equal(body.model, VALID.model);
  assert.equal(body.masked, maskOpenAIKey(VALID.apiKey));
});

test("handleSave returns 400 for invalid JSON body", async () => {
  const req = new Request("http://127.0.0.1/api/openai-key/save", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: "{not json",
  });
  const res = await handleSave(req, {
    allowedOriginHost: null,
    saveOpenAIKey: async () => {},
    logError: () => {},
  });
  assert.equal(res.status, 400);
});

test("handleSave returns 400 for Zod-invalid payload", async () => {
  const res = await handleSave(jsonRequest({ apiKey: "sk-short", model: "gpt-99" }), {
    allowedOriginHost: null,
    saveOpenAIKey: async () => {},
    logError: () => {},
  });
  assert.equal(res.status, 400);
  const body = (await res.json()) as Record<string, unknown>;
  assert.equal(body.error, "Invalid body");
});
