// Doc-style pin for /api/notes/:noteId/handwriting/pages.
//
// Behaviour is covered by `src/lib/api/handwriting.spec.ts` (pure handler
// tests with injected repos). This file pins the structural decisions in
// the route file itself:
//   - createFileRoute MUST be given the exact path, including the trailing
//     "/pages" segment — otherwise TanStack won't register GET/PUT here.
//   - GET and PUT must delegate to the pure handlers (no inline logic).
//   - PUT must read the JSON body via `request.json()` so a missing/malformed
//     body returns 400, not 500.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const source = readFileSync(resolve(here, "$noteId.handwriting.pages.ts"), "utf8");

test("route file uses createFileRoute with the exact path", () => {
  assert.match(source, /createFileRoute\(["']\/api\/notes\/\$noteId\/handwriting\/pages["']\)/);
});

test("route file registers GET and PUT handlers", () => {
  assert.match(source, /GET:\s*async\s*\(\{\s*params\s*\}/);
  assert.match(source, /PUT:\s*async\s*\(\{\s*params/);
});

test("GET delegates to handleGetPages with the noteId param", () => {
  assert.match(source, /handleGetPages\(params\.noteId\)/);
});

test("PUT reads the body via request.json and delegates to handlePutPage", () => {
  assert.match(source, /await request\.json\(\)/);
  assert.match(source, /handlePutPage\(params\.noteId,\s*body\)/);
});

test("PUT returns a 400 json response on a malformed body instead of crashing", () => {
  // The try/catch around `request.json()` ensures a missing/invalid JSON body
  // returns 400 rather than letting the parse throw and bubble up as a 500.
  // The catch binding is optional in modern TS, so we accept either
  // `catch { ... }` (no binding) or `catch (e) { ... }`.
  assert.match(source, /catch\s*(?:\(\s*\))?\s*\{[\s\S]*status:\s*400[\s\S]*\}/);
});

test("PUT's malformed-body branch routes through apiJson (L1 safety header contract)", () => {
  // Every /api/* error response must use apiJson so X-Content-Type-Options:
  // nosniff is guaranteed. A hand-rolled Response here would silently bypass
  // that contract — pin it explicitly.
  assert.match(source, /apiJson\(\s*\{\s*error:\s*["']invalid-body["']/);
});
