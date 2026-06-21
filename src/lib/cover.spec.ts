// cover.spec.ts — TDD regression guard for src/lib/cover.ts
// Verifies `compressCoverFile` exists as a top-level export of `@/lib/cover`,
// so route files can import it from the utility module instead of the
// legacy localStorage shim `@/lib/books-store`.

import { test } from "node:test";
import assert from "node:assert/strict";

test("compressCoverFile is exported from @/lib/cover", async () => {
  const mod = await import("./cover");
  assert.equal(
    typeof mod.compressCoverFile,
    "function",
    "compressCoverFile must be exported from @/lib/cover",
  );
});
