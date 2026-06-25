// TDD tests for /api/assets/[id] (M14 + mime allowlist pin).
//
// M14: the asset body is served as a Buffer via the Response constructor
// instead of a hand-rolled ReadableStream. The contract is: Content-Length
// matches the buffer's byteLength (not the DB row's `bytes` column, which
// can drift if a future migration recompresses the file).
import { test } from "node:test";
import assert from "node:assert/strict";
import { handleAssetGet, safeMime } from "./assets/$id";

const VALID_ID = "abc123_-";
const FAKE_BYTES = new Uint8Array([0xff, 0xd8, 0xff, 0xe0]); // JPEG SOI
const FAKE_BUFFER = Buffer.from(FAKE_BYTES);

function fakeReader(
  opts: { row?: { mime: string | null; bytes: number } | null; throwOnRead?: boolean } = {},
) {
  return async (id: string) => {
    if (opts.throwOnRead) throw new Error("disk on fire");
    if (opts.row === null) return null;
    return {
      bytes: FAKE_BUFFER,
      row: { id, ...(opts.row ?? { mime: "image/jpeg", bytes: FAKE_BUFFER.byteLength }) },
    };
  };
}

test("handleAssetGet returns 400 for an id that fails the allowlist", async () => {
  const res = await handleAssetGet("..%2F..%2Fetc%2Fpasswd");
  assert.equal(res.status, 400);
});

test("handleAssetGet returns 404 when the reader returns null", async () => {
  const res = await handleAssetGet(VALID_ID, { readAssetBytes: fakeReader({ row: null }) });
  assert.equal(res.status, 404);
});

test("handleAssetGet serves the bytes with Content-Length matching byteLength", async () => {
  const res = await handleAssetGet(VALID_ID, {
    readAssetBytes: fakeReader({ row: { mime: "image/jpeg", bytes: 999 } }),
  });
  assert.equal(res.status, 200);
  // M14: Content-Length is the buffer's byteLength (4), NOT the DB row's
  // stale 999. Buffer constructor auto-sets the header in undici.
  assert.equal(res.headers.get("content-length"), String(FAKE_BUFFER.byteLength));
  const body = new Uint8Array(await res.arrayBuffer());
  assert.deepEqual([...body], [...FAKE_BYTES]);
});

test("handleAssetGet downgrades unknown mime to octet-stream", async () => {
  const res = await handleAssetGet(VALID_ID, {
    readAssetBytes: fakeReader({ row: { mime: "text/html", bytes: 4 } }),
  });
  assert.equal(res.headers.get("content-type"), "application/octet-stream");
});

test("safeMime allowlist excludes image/svg+xml (stored-XSS defence)", () => {
  assert.equal(safeMime("image/svg+xml"), "application/octet-stream");
});

test("safeMime allowlist excludes text/html (stored-XSS defence)", () => {
  assert.equal(safeMime("text/html"), "application/octet-stream");
});

test("safeMime passes through canonical image types", () => {
  for (const m of ["image/jpeg", "image/png", "image/webp", "image/gif", "image/avif"]) {
    assert.equal(safeMime(m), m);
  }
});

test("safeMime returns octet-stream for null/undefined", () => {
  assert.equal(safeMime(null), "application/octet-stream");
  assert.equal(safeMime(undefined), "application/octet-stream");
});
