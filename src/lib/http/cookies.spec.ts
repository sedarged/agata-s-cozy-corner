// Agata — tests for the tiny cookie helpers used by the OAuth routes.
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  parseCookieHeader,
  serializeSetCookie,
  serializeClearCookie,
  isHttpsRequest,
} from "./cookies";

describe("parseCookieHeader", () => {
  it("returns an empty record for null/undefined/empty header", () => {
    assert.deepEqual(parseCookieHeader(null), {});
    assert.deepEqual(parseCookieHeader(""), {});
  });

  it("parses a single cookie", () => {
    assert.deepEqual(parseCookieHeader("foo=bar"), { foo: "bar" });
  });

  it("parses multiple cookies", () => {
    assert.deepEqual(parseCookieHeader("a=1; b=2; c=3"), { a: "1", b: "2", c: "3" });
  });

  it("decodes URI-encoded values", () => {
    assert.deepEqual(parseCookieHeader("gigi.verifier=hello%20world"), {
      "gigi.verifier": "hello world",
    });
  });

  it("skips malformed segments silently", () => {
    assert.deepEqual(parseCookieHeader("; ;foo=bar"), { foo: "bar" });
  });
});

describe("serializeSetCookie", () => {
  it("always sets Path=/, HttpOnly, SameSite=Lax by default", () => {
    const v = serializeSetCookie({ name: "gigi.pkce", value: "abc" });
    assert.match(v, /gigi\.pkce=abc/);
    assert.match(v, /Path=\//);
    assert.match(v, /HttpOnly/);
    assert.match(v, /SameSite=Lax/);
  });

  it("includes Secure when requested", () => {
    assert.match(serializeSetCookie({ name: "x", value: "y", secure: true }), /Secure/);
    assert.doesNotMatch(serializeSetCookie({ name: "x", value: "y" }), /Secure/);
  });

  it("URL-encodes the value", () => {
    const v = serializeSetCookie({ name: "k", value: "hello world" });
    assert.match(v, /k=hello%20world/);
  });

  it("single round-trip preserves a JSON payload when caller passes the raw string", () => {
    // Regression for 2026-06-24 `gigi.oauth` callback bug: login.ts was
    // calling `encodeURIComponent(JSON.stringify({state, verifier}))` AND
    // `serializeSetCookie` does its own encodeURIComponent, producing a
    // doubly-encoded cookie value. The browser stored it verbatim;
    // `parseCookieHeader` decoded once on the way back, leaving a still-
    // encoded JSON-ish string. `JSON.parse` then threw and the callback
    // fell through to `?chatgpt=error&reason=expired`.
    //
    // Contract: callers pass RAW values; `serializeSetCookie` is
    // responsible for the single encoding. This test pins that contract
    // by simulating the full write→read round-trip and asserting that
    // `JSON.parse` succeeds.
    const payload = JSON.stringify({ state: "abc", verifier: "def" });
    const setHeader = serializeSetCookie({ name: "gigi.oauth", value: payload });
    // Browser sends the cookie back as the raw value of `gigi.oauth=...`.
    const cookieHeader = setHeader.split(";")[0];
    const parsed = parseCookieHeader(cookieHeader);
    const round = JSON.parse(parsed["gigi.oauth"]!);
    assert.equal(round.state, "abc");
    assert.equal(round.verifier, "def");
  });

  it("honours custom Max-Age", () => {
    assert.match(serializeSetCookie({ name: "x", value: "y", maxAgeSeconds: 60 }), /Max-Age=60/);
  });
});

describe("serializeClearCookie", () => {
  it("produces an expiring cookie (Max-Age=0)", () => {
    const v = serializeClearCookie("gigi.pkce");
    assert.match(v, /gigi\.pkce=/);
    assert.match(v, /Max-Age=0/);
  });
});

describe("isHttpsRequest", () => {
  it("returns true when x-forwarded-proto is https", () => {
    assert.equal(
      isHttpsRequest(new Request("http://x/y", { headers: { "x-forwarded-proto": "https" } })),
      true,
    );
  });
  it("returns true when request URL is https", () => {
    assert.equal(isHttpsRequest(new Request("https://x/y")), true);
  });
  it("returns false when neither", () => {
    assert.equal(isHttpsRequest(new Request("http://x/y")), false);
  });
});
