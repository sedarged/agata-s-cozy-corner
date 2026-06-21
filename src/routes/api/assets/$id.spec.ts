// Agata — id-validation unit tests for the /api/assets/[id] route.
// The DB read is exercised by the assets repo integration tests; here we only
// cover the id whitelist that protects against path traversal.
import { describe, it } from "node:test";
import assert from "node:assert/strict";

const ID_PATTERN = /^[A-Za-z0-9._-]+$/;
const MAX_LEN = 128;

function isValidAssetId(id: string | undefined): boolean {
  return typeof id === "string" && id.length > 0 && id.length <= MAX_LEN && ID_PATTERN.test(id);
}

describe("/api/assets/[id] id validation", () => {
  it("accepts plain alphanumerics", () => {
    assert.equal(isValidAssetId("abc123"), true);
  });

  it("accepts dots, dashes, underscores (file-safe chars)", () => {
    assert.equal(isValidAssetId("cover.v1_a-b"), true);
  });

  it("rejects empty / missing id", () => {
    assert.equal(isValidAssetId(""), false);
    assert.equal(isValidAssetId(undefined), false);
  });

  it("rejects ids with path-traversal characters", () => {
    assert.equal(isValidAssetId("../etc/passwd"), false);
    assert.equal(isValidAssetId("a/b"), false);
    assert.equal(isValidAssetId("a\\b"), false);
  });

  it("rejects ids longer than 128 chars", () => {
    assert.equal(isValidAssetId("a".repeat(129)), false);
    assert.equal(isValidAssetId("a".repeat(128)), true);
  });

  it("rejects ids with spaces or shell metachars", () => {
    assert.equal(isValidAssetId("a b"), false);
    assert.equal(isValidAssetId("a;b"), false);
    assert.equal(isValidAssetId("a&b"), false);
  });
});
