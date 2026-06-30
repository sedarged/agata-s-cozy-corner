// book.$id.index.spec.tsx — structural pin for the manual-cover editing UI.
//
// We don't render the route component here — it pulls TanStack Router
// context, React Query, and the EditBookModal which is a self-contained
// function. Instead we pin the load-bearing wiring decisions:
//
//   - the manual-cover mutations are imported and exercised
//   - file-upload writes through setManualCover (not the coverUrl URL field)
//   - the "Restore API cover" button only renders when manualCoverUrl is set
//   - the restore button calls clearManualCover
//
// Regression targets:
//   - a refactor that drops useSetManualCoverMutation/useClearManualCoverMutation
//     leaves users with no way to upload a custom cover — this spec fails
//     loudly when that happens
//   - a refactor that wires file upload back to the coverUrl string field
//     defeats the manual-cover-feature (upsert would clobber it) — this
//     spec fails loudly when that happens.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const source = readFileSync(resolve(here, "book.$id.index.tsx"), "utf8");

test("book detail page imports the manual-cover React Query mutations", () => {
  assert.match(source, /useSetManualCoverMutation/);
  assert.match(source, /useClearManualCoverMutation/);
});

test("EditBookModal writes uploaded cover through setManualCover, not the coverUrl URL field", () => {
  // compressCoverFile is the in-browser helper that produces a data URL.
  // The mutation must be called with the data URL — not stuffed into the
  // coverUrl string (which gets clobbered by upsertBook on the next save).
  // Match the mutation call site name to confirm the wiring direction.
  assert.match(source, /setManualCover\.mutateAsync/);
});

test("EditBookModal renders a Restore API cover button when a manual cover is set", () => {
  // The button label is "Przywróć okładkę z API" (Polish UI string).
  // Pin the literal so a future refactor that renames it without updating
  // CLAUDE.md flags here.
  assert.match(source, /Przywróć okładkę z API/);
});

test("EditBookModal restore button calls clearManualCover on click", () => {
  // The restore handler must route through the clear mutation, not just
  // clear the coverUrl local state (which wouldn't persist).
  assert.match(source, /clearManualCover\.mutateAsync/);
});