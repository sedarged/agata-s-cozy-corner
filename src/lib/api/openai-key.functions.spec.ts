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

// --- M3: sanitizeRpcErrorBody ----------------------------------------------
// The error message used to include the full response body, which leaks
// internal state on 5xx (DB error JSON, stack traces). Cap to 200 chars
// and strip newlines so the toast / log stays single-line.

import { sanitizeRpcErrorBody, RPC_TIMEOUT_MS } from "./openai-key.functions";

test("sanitizeRpcErrorBody returns empty string for empty body", () => {
  assert.equal(sanitizeRpcErrorBody(""), "");
});

test("sanitizeRpcErrorBody returns body unchanged when shorter than cap", () => {
  assert.equal(sanitizeRpcErrorBody("nope"), "nope");
});

test("sanitizeRpcErrorBody truncates body to 200 chars with an ellipsis", () => {
  const long = "x".repeat(500);
  const out = sanitizeRpcErrorBody(long);
  assert.ok(out.length <= 200, `expected ≤ 200 chars, got ${out.length}`);
  assert.ok(out.endsWith("…"), "should end with an ellipsis to signal truncation");
});

test("sanitizeRpcErrorBody strips newlines so the error stays single-line", () => {
  const multi = "line1\nline2\rline3\r\nline4";
  const out = sanitizeRpcErrorBody(multi);
  assert.ok(!out.includes("\n"), "no LF allowed");
  assert.ok(!out.includes("\r"), "no CR allowed");
  assert.match(out, /line1 line2 line3 line4/);
});

test("sanitizeRpcErrorBody truncates AFTER stripping newlines", () => {
  // 26 blocks of 10 'x's joined by '\n' = 286 chars including newlines.
  // After stripping newlines it's still > 200 chars and must truncate.
  const s = Array.from({ length: 26 }, () => "x".repeat(10)).join("\n");
  const out = sanitizeRpcErrorBody(s);
  assert.ok(out.length <= 200);
});

// --- H1: RPC_TIMEOUT_MS constant -------------------------------------------

test("RPC_TIMEOUT_MS is exported, positive, and ≤ 60s", () => {
  // Defensive upper bound: 60s. Today it's 15s; the test guards
  // against someone bumping it to a multi-minute value by accident
  // (would block the Nitro event loop on a dead upstream).
  assert.ok(typeof RPC_TIMEOUT_MS === "number");
  assert.ok(RPC_TIMEOUT_MS > 0);
  assert.ok(RPC_TIMEOUT_MS <= 60_000);
});
