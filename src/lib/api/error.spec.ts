// L1: X-Content-Type-Options: nosniff on every JSON response.
//
// The header prevents legacy browsers / curl-style agents from
// "MIME-sniffing" a response body away from the declared
// content-type. Without it, an attacker who can inject crafted bytes
// into a JSON path (e.g. via a query param echoed into the body) could
// trick a browser into rendering the response as HTML / script.
//
// We expose a single shared helper (apiJson) and pin the contract:
//   - content-type is application/json
//   - X-Content-Type-Options is "nosniff"
//   - caller-provided headers / status are respected
//   - body is JSON.stringify'd
import { test } from "node:test";
import assert from "node:assert/strict";
import { apiJson, NO_SNIFF } from "./error";

test("apiJson sets X-Content-Type-Options: nosniff (L1)", async () => {
  const res = apiJson({ error: "bad input" });
  assert.equal(res.headers.get("X-Content-Type-Options"), "nosniff");
});

test("apiJson sets content-type to application/json", async () => {
  const res = apiJson({ error: "bad input" });
  assert.match(res.headers.get("content-type") ?? "", /application\/json/);
});

test("apiJson defaults to status 200", () => {
  const res = apiJson({ ok: true });
  assert.equal(res.status, 200);
});

test("apiJson honours an explicit status override", () => {
  const res = apiJson({ error: "nope" }, { status: 503 });
  assert.equal(res.status, 503);
  assert.equal(res.headers.get("X-Content-Type-Options"), "nosniff");
});

test("apiJson JSON-stringifies the body", async () => {
  const res = apiJson({ error: 'with quote: "x"' });
  const parsed = (await res.json()) as { error: string };
  assert.equal(parsed.error, 'with quote: "x"');
});

test("apiJson preserves caller-provided headers", () => {
  const res = apiJson({ error: "x" }, { headers: { "x-trace": "abc" } });
  assert.equal(res.headers.get("X-Content-Type-Options"), "nosniff");
  assert.equal(res.headers.get("x-trace"), "abc");
});

test("apiJson safety headers win over caller-provided same-name headers", () => {
  // A caller could naively set X-Content-Type-Options: unsafe to defeat the
  // policy. We merge AFTER so the safety header always wins.
  const res = apiJson(
    { ok: true },
    { headers: { "X-Content-Type-Options": "unsafe", "content-type": "text/plain" } },
  );
  assert.equal(res.headers.get("X-Content-Type-Options"), "nosniff");
  assert.match(res.headers.get("content-type") ?? "", /application\/json/);
});

test("NO_SNIFF exported value is the literal 'nosniff'", () => {
  assert.equal(NO_SNIFF, "nosniff");
});