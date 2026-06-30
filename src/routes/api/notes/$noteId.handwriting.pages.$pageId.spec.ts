// Doc-style pin for /api/notes/:noteId/handwriting/pages/:pageId.
//
// Behaviour is covered by `src/lib/api/handwriting.spec.ts` (the DELETE
// section exercises the cross-note 404, the missing-page 404, and the
// renumberPages side-effect). This file pins the structural decisions in
// the route file itself:
//   - createFileRoute MUST be given the exact 2-param path.
//   - Only a DELETE handler is registered (no GET / PUT).
//   - The handler delegates to handleDeletePage with both params.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const source = readFileSync(resolve(here, "$noteId.handwriting.pages.$pageId.ts"), "utf8");

test("route file uses createFileRoute with the exact 2-param path", () => {
  assert.match(
    source,
    /createFileRoute\(\s*["']\/api\/notes\/\$noteId\/handwriting\/pages\/\$pageId["']\s*\)/,
  );
});

test("route file registers a DELETE handler and nothing else", () => {
  assert.match(source, /DELETE:\s*async/);
  assert.doesNotMatch(source, /\bGET:\s*async/);
  assert.doesNotMatch(source, /\bPUT:\s*async/);
  assert.doesNotMatch(source, /\bPOST:\s*async/);
  assert.doesNotMatch(source, /\bPATCH:\s*async/);
});

test("DELETE delegates to handleDeletePage with both params", () => {
  assert.match(source, /handleDeletePage\(params\.noteId,\s*params\.pageId\)/);
});
