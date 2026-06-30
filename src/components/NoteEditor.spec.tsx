// NoteEditor.spec.tsx — structural pin for the HandwritingCanvas multi-page
// integration.
//
// We don't render NoteEditor here — it pulls TanStack Router context, React
// Query, and several sibling components. Instead we pin the JSX-level
// decisions that wire the canvas into the multi-page API:
//
//   - the multi-page React Query hooks are imported
//   - when an existing note id is set, the canvas receives noteId + pages +
//     the page-mutation callbacks
//   - when no note id is set (new-note draft), the canvas falls back to the
//     legacy initialDataUrl flow (so old drafts keep loading)
//
// Regression target: a refactor that drops the page-mutation wiring silently
// leaves users with a single-page canvas on existing notes — this spec fails
// CI loudly when that happens.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const source = readFileSync(resolve(here, "NoteEditor.tsx"), "utf8");

test("NoteEditor imports the multi-page React Query hooks + DTO type", () => {
  assert.match(source, /useHandwritingPagesQuery/);
  assert.match(source, /useSaveHandwritingPageMutation/);
  assert.match(source, /useDeleteHandwritingPageMutation/);
  assert.match(source, /HandwritingPageDTO/);
});

test("NoteEditor reads pages via the React Query hook when existingNoteId is set", () => {
  // The hook must be called inside the component with `existingNoteId` as
  // the argument (or `existingNoteId ?? undefined`). Result goes into local
  // state for the canvas. The `?? undefined` form is allowed so the React
  // Query `enabled` predicate still fires when the id is set.
  assert.match(source, /useHandwritingPagesQuery\(\s*existingNoteId(?:\s*\?\?\s*undefined)?\s*\)/);
});

test("NoteEditor passes noteId + pages + callbacks to HandwritingCanvas in existing-note mode", () => {
  // The canvas tag must receive every multi-page prop. We assert each one
  // individually so any single regression (e.g. dropping onAddPage) trips CI.
  // Critical: the parent must own active-page state via the controlled
  // props (activePageId + onSelectPage). Without those two, the canvas
  // tracks its own localActivePageId and the parent's `effectiveActivePageId`
  // is dead state — strokes get PUT to the wrong page on add/prev/next.
  assert.match(source, /<HandwritingCanvas[\s\S]*?noteId=\{existingNoteId\}/);
  assert.match(source, /<HandwritingCanvas[\s\S]*?pages=\{pagesData/);
  assert.match(source, /<HandwritingCanvas[\s\S]*?activePageId=\{effectiveActivePageId\}/);
  assert.match(source, /<HandwritingCanvas[\s\S]*?onSelectPage=\{setActivePageId\}/);
  assert.match(source, /<HandwritingCanvas[\s\S]*?onStrokesChange=\{handleStrokesChange\}/);
  assert.match(source, /<HandwritingCanvas[\s\S]*?onAddPage=\{handleAddPage\}/);
  assert.match(source, /<HandwritingCanvas[\s\S]*?onDeletePage=\{handleDeletePage\}/);
});

test("NoteEditor preserves the legacy initialDataUrl path for new-note drafts", () => {
  // A new note has no existingNoteId → no pages row yet → falls back to
  // initialDataUrl from local draft. The prop must STILL be wired so
  // draft recovery keeps working.
  assert.match(source, /initialDataUrl=\{initialDrawingForCanvas\}/);
});

test("handleStrokesChange saves the active page via useSaveHandwritingPageMutation", () => {
  // The handler must pull `pages` + the active page id to find the current
  // page and PUT it back with the new strokes. Pin the mutation call so a
  // future refactor that forgets to persist strokes trips CI. Field order
  // in the object literal isn't pinned (the server normalises), only that
  // every required field is present.
  assert.match(
    source,
    /savePageMutation\.mutate(?:Async)?\(\s*\{[\s\S]*?noteId:\s*existingNoteId[\s\S]*?strokes[\s\S]*?\}/,
  );
});

test("handleAddPage creates a new page with empty strokes and selects it", () => {
  // Adding a page is a PUT with empty strokes + id = genId("hwp") and an
  // immediate local selection. Pin the id prefix so a refactor that picks
  // "hwpage" instead of "hwp" fails the existing unit suite in /api/notes.
  assert.match(source, /genId\(["']hwp["']\)/);
  assert.match(source, /setActivePageId\(/);
});

test("handleDeletePage calls useDeleteHandwritingPageMutation with the deleted page id", () => {
  // The handler parameter is named `pageId` (not shadowed `activePageId`)
  // so the data flow from the canvas → handler → mutation is unambiguous.
  // We allow either `pageId: pageId` or `pageId,` (object shorthand) since
  // both compile to the same wire shape.
  assert.match(
    source,
    /deletePageMutation\.mutate(?:Async)?\(\s*\{\s*noteId:\s*existingNoteId[\s\S]*?pageId(?::\s*pageId)?\s*,?\s*\}\s*\)/,
  );
});
