// Regression guard: src/routes/library.tsx must not import from localStorage
// store shims. The library page is now driven by React Query
// (useBooksQuery) backed by the Drizzle/SQLite server.
//
// node:test is the project standard (see `npm test` in package.json).

import { test } from "node:test";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import assert from "node:assert/strict";

const LIBRARY_PATH = fileURLToPath(new URL("./library.tsx", import.meta.url));

test("library.tsx does not import from any localStorage store shim", async () => {
  const src = await readFile(LIBRARY_PATH, "utf8");
  // The migration moved library data access to @/lib/api/client.
  // These shims must never come back in this file.
  assert.equal(
    /@\/lib\/books-store/.test(src),
    false,
    "library.tsx must not import @/lib/books-store",
  );
  assert.equal(
    /@\/lib\/effective-books/.test(src),
    false,
    "library.tsx must not import @/lib/effective-books",
  );
  assert.equal(
    /@\/lib\/book-workspace-store/.test(src),
    false,
    "library.tsx must not import @/lib/book-workspace-store",
  );
});

test("library.tsx uses the React Query hook from @/lib/api/client", async () => {
  const src = await readFile(LIBRARY_PATH, "utf8");
  assert.match(
    src,
    /import\s*\{[^}]*useBooksQuery[^}]*\}\s*from\s*['"]@\/lib\/api\/client['"]/,
    "library.tsx must import useBooksQuery from @/lib/api/client",
  );
});

test("library.tsx exports Library as a named export (so unit tests can render it)", async () => {
  const src = await readFile(LIBRARY_PATH, "utf8");
  assert.match(
    src,
    /export\s+function\s+Library/,
    "library.tsx must export Library as a named function",
  );
});
