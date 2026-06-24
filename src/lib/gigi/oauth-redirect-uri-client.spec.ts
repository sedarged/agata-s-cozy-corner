// Agata — tests for the client-side redirect-uri fetcher.
//
// The fetcher must:
//   - return the `uri` string when the endpoint responds 200 + valid JSON
//   - throw on a non-2xx response (so the UI shows a real error instead
//     of pasting into a stale or wrong textarea)
//   - throw when the payload is missing `uri` or has an empty one
//     (silent fallback here would mismatch what /login sends to OpenAI
//     and cause a real OAuth state-mismatch failure at consent time)

import { afterEach, beforeEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import { fetchRedirectUri } from "./oauth-redirect-uri-client";

type FetchFn = typeof fetch;
const ORIGINAL_FETCH = globalThis.fetch;

function mockFetch(impl: FetchFn): void {
  globalThis.fetch = impl as unknown as FetchFn;
}

function restoreFetch(): void {
  globalThis.fetch = ORIGINAL_FETCH;
}

beforeEach(() => {
  // Each test installs its own mock; restore in afterEach.
});

afterEach(restoreFetch);

describe("fetchRedirectUri", () => {
  it("returns the uri string on 200 + valid JSON", async () => {
    mockFetch(
      async () =>
        new Response(JSON.stringify({ uri: "https://mycozylibary.com/api/chatgpt/callback" }), {
          status: 200,
          headers: { "content-type": "application/json" },
        }),
    );
    const uri = await fetchRedirectUri();
    assert.equal(uri, "https://mycozylibary.com/api/chatgpt/callback");
  });

  it("returns the loopback uri when the server falls back to default", async () => {
    mockFetch(
      async () =>
        new Response(JSON.stringify({ uri: "http://127.0.0.1:3001/api/chatgpt/callback" }), {
          status: 200,
        }),
    );
    const uri = await fetchRedirectUri();
    assert.equal(uri, "http://127.0.0.1:3001/api/chatgpt/callback");
  });

  it("throws when the endpoint responds non-2xx", async () => {
    mockFetch(async () => new Response("nope", { status: 500 }));
    await assert.rejects(fetchRedirectUri(), /redirect-uri 500/);
  });

  it("throws when the JSON payload has no `uri` field", async () => {
    mockFetch(
      async () =>
        new Response(JSON.stringify({}), {
          status: 200,
          headers: { "content-type": "application/json" },
        }),
    );
    await assert.rejects(fetchRedirectUri(), /missing `uri`/);
  });

  it("throws when the `uri` field is an empty string", async () => {
    mockFetch(
      async () =>
        new Response(JSON.stringify({ uri: "" }), {
          status: 200,
          headers: { "content-type": "application/json" },
        }),
    );
    await assert.rejects(fetchRedirectUri(), /missing `uri`/);
  });

  it("throws when the `uri` field is not a string", async () => {
    mockFetch(
      async () =>
        new Response(JSON.stringify({ uri: 42 }), {
          status: 200,
          headers: { "content-type": "application/json" },
        }),
    );
    await assert.rejects(fetchRedirectUri(), /missing `uri`/);
  });
});
