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
