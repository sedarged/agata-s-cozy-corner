import { test } from "node:test";
import assert from "node:assert/strict";
import { OpenAIKeyInputSchema } from "./schemas";
import { resolveServerUrl } from "./openai-key.functions";

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

// --- resolveServerUrl ---
// Node fetch (undici) throws "Failed to parse URL from /api/…" on
// relative paths. The server-function handlers run server-side, so
// rpc() must build an absolute URL from PORT/HOST env.

test("resolveServerUrl returns an absolute URL with the configured port", () => {
  const prevPort = process.env.PORT;
  const prevHost = process.env.HOST;
  process.env.PORT = "4174";
  process.env.HOST = "127.0.0.1";
  try {
    const url = resolveServerUrl("/api/openai-key/save");
    assert.equal(url, "http://127.0.0.1:4174/api/openai-key/save");
  } finally {
    if (prevPort === undefined) delete process.env.PORT;
    else process.env.PORT = prevPort;
    if (prevHost === undefined) delete process.env.HOST;
    else process.env.HOST = prevHost;
  }
});

test("resolveServerUrl falls back to 127.0.0.1:3002 when env unset", () => {
  const prevPort = process.env.PORT;
  const prevHost = process.env.HOST;
  delete process.env.PORT;
  delete process.env.HOST;
  try {
    const url = resolveServerUrl("/api/openai-key/save");
    assert.equal(url, "http://127.0.0.1:3002/api/openai-key/save");
  } finally {
    if (prevPort !== undefined) process.env.PORT = prevPort;
    if (prevHost !== undefined) process.env.HOST = prevHost;
  }
});

test("resolveServerUrl preserves query string and hash", () => {
  const prevPort = process.env.PORT;
  const prevHost = process.env.HOST;
  process.env.PORT = "3002";
  process.env.HOST = "127.0.0.1";
  try {
    const url = resolveServerUrl("/api/x?y=1#z");
    assert.equal(url, "http://127.0.0.1:3002/api/x?y=1#z");
  } finally {
    if (prevPort === undefined) delete process.env.PORT;
    else process.env.PORT = prevPort;
    if (prevHost === undefined) delete process.env.HOST;
    else process.env.HOST = prevHost;
  }
});

test("resolveServerUrl rejects scheme-relative paths (SSRF guard)", () => {
  // "//evil.com/x" would be parsed by URL as scheme-relative and pivot
  // the fetch to evil.com — reject before constructing the URL.
  assert.throws(() => resolveServerUrl("//evil.com/x"), /must start with "\/"/);
  assert.throws(() => resolveServerUrl("http://evil.com"), /must start with "\/"/);
  assert.throws(() => resolveServerUrl("api/openai-key/save"), /must start with "\/"/);
});
