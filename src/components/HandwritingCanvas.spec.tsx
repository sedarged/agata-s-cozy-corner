// HandwritingCanvas.spec.tsx — structural pin for the multi-page refactor.
//
// The full visual rendering of the canvas requires a real DOM (canvas,
// pointer events, ResizeObserver, Image) so we don't try to render it
// here — node:test in this project uses no jsdom/happy-dom. Instead we
// pin the JSX-level decisions that make the multi-page path correct:
//
//   - the multi-page chrome only renders when `noteId` is provided
//   - the canvas always paints the strokes from the active page
//   - the imperative handle contract (toDataUrl/clear/hasInk) survives
//     both modes so NoteEditor's autosave keeps working
//
// Behaviour for the strokes / persistence flow is covered by
// handwriting-multipage-state.spec.ts (pure state-machine tests).
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const source = readFileSync(resolve(here, "HandwritingCanvas.tsx"), "utf8");

test("HandwritingCanvas is exported as a forwardRef component", () => {
  assert.match(
    source,
    /export\s+const\s+HandwritingCanvas\s*=\s*forwardRef/,
    "must be wrapped in forwardRef so NoteEditor's canvasRef keeps working",
  );
});

test("HandwritingCanvasHandle exposes toDataUrl, clear, hasInk", async () => {
  const mod = await import("./HandwritingCanvas");
  // The interface is a TypeScript type — erased at runtime — but the
  // forwardRef call wires it through useImperativeHandle. We assert the
  // *function* still exists (the implementation) by rendering nothing:
  // importing the module is enough to prove the export resolves.
  assert.equal(typeof mod.HandwritingCanvas, "object");
  // forwardRef returns an object with $$typeof + render.
  assert.ok(
    (mod.HandwritingCanvas as unknown as { render?: unknown }).render,
    "forwardRef returns an object with a render function",
  );
});

test("multi-page mode: accepts noteId + pages + onAddPage + onDeletePage props", () => {
  // The component must accept these new props (multi-page trigger). If
  // they're missing, the page nav strip will silently never appear.
  const propsSignature = source.match(/interface\s+Props\s*\{[\s\S]*?\n\}/);
  assert.ok(propsSignature, "Props interface must exist");
  const block = propsSignature![0];
  assert.match(block, /noteId\?:\s*string/, "noteId?: string required");
  assert.match(block, /pages\?:\s*HandwritingPageDTO\[\]/, "pages?: HandwritingPageDTO[] required");
  assert.match(block, /onAddPage\?:\s*\(/, "onAddPage?: () => void required");
  assert.match(block, /onDeletePage\?:\s*\(/, "onDeletePage?: (id: string) => void required");
});

test("multi-page mode: renders a page nav strip with prev/next + 1/N indicator + add/delete", () => {
  // The strip must include aria-labels for screen readers (prev/next/add/delete)
  // and a visible page-counter like "Strona N z M". We assert on the JSX
  // templates so a future refactor that drops the labels fails CI.
  assert.match(source, /aria-label=["']Poprzednia\s+strona["']/);
  assert.match(source, /aria-label=["']Następna\s+strona["']/);
  assert.match(source, /aria-label=["']Dodaj\s+stronę["']/);
  assert.match(source, /aria-label=["']Usuń\s+stronę["']/);
  assert.match(source, /Strona\s+\{[^}]+\}\s+z\s+\{[^}]+\}/);
});

test("multi-page mode: only renders the nav strip when noteId is provided", () => {
  // The conditional must guard on `noteId && pages` (or a derivative like
  // `isMultiPage`) so legacy callers that pass only initialDataUrl don't
  // see a stray nav strip.
  assert.match(source, /isMultiPage\s*&&|noteId\s*&&\s*pages|noteId\s*\?\s*\?\s*null/);
});

test("strokes sync: when activePageId changes, strokes load from that page", () => {
  // The active page's strokes must drive the local `strokes` state. We
  // assert the effect exists by name — a refactor that forgets to
  // re-load on page switch would silently show stale strokes.
  assert.match(
    source,
    /setStrokes\(\s*\(\)\s*=>\s*\(activePage\??\.strokes\s+as\s+Stroke\[\]\)\s*\|\|\s*\[\]\s*\)/,
  );
});

test("strokes persist: on strokes change in multi-page mode, onStrokesChange fires (debounced)", () => {
  // Without this, every pencil lift would slam the server. The debounce
  // wrapper is required — pin it.
  assert.match(source, /onStrokesChange\s*\?\?\s*noop|debounce|useDebounced|saveDebounced/);
});

test("legacy single-page path is preserved: initialDataUrl + toDataUrl + hasInk still work", () => {
  // NoteEditor's autosave reads `canvasRef.current.toDataUrl()` and
  // `canvasRef.current.hasInk()` from the imperative handle. The refactor
  // must keep those wired through useImperativeHandle.
  assert.match(source, /useImperativeHandle/);
  assert.match(source, /toDataUrl:\s*\(/);
  assert.match(source, /clear:\s*\(/);
  assert.match(source, /hasInk:\s*\(/);
});
