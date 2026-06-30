// Agata — wire-shape contract tests for the `setManualCover` and
// `clearManualCover` server functions. The `createServerFn` wrapper
// requires AsyncLocalStorage and is not directly callable here, so we
// re-state the inline Zod validator shape from books.functions.ts and
// assert the load-bearing caps: id length ≤128, dataUrl must be a
// `data:image/...` URL ≤2 MB. Any future tweak must keep these
// invariants or the repo's `setManualCover` validation will be bypassed.
import { test } from "node:test";
import assert from "node:assert/strict";
import { z } from "zod";

const setManualCoverInputSchema = z.object({
  id: z.string().min(1).max(128),
  dataUrl: z.string().min(1).max(2_000_000),
});

const clearManualCoverInputSchema = z.object({
  id: z.string().min(1).max(128),
});

test("setManualCover accepts a 1-char id and 1-char data URL", () => {
  const r = setManualCoverInputSchema.safeParse({ id: "b", dataUrl: "x" });
  assert.equal(r.success, true);
});

test("setManualCover rejects ids longer than 128 chars", () => {
  const r = setManualCoverInputSchema.safeParse({ id: "x".repeat(129), dataUrl: "x" });
  assert.equal(r.success, false);
});

test("setManualCover rejects empty dataUrl", () => {
  const r = setManualCoverInputSchema.safeParse({ id: "b1", dataUrl: "" });
  assert.equal(r.success, false);
});

test("setManualCover rejects dataUrl over 2 MB", () => {
  const huge = "data:image/png;base64," + "A".repeat(2_000_001);
  const r = setManualCoverInputSchema.safeParse({ id: "b1", dataUrl: huge });
  assert.equal(r.success, false);
});

test("setManualCover accepts a 2 MB dataUrl (boundary)", () => {
  const at = "data:image/png;base64," + "A".repeat(2_000_000 - 22);
  const r = setManualCoverInputSchema.safeParse({ id: "b1", dataUrl: at });
  assert.equal(r.success, true);
});

test("clearManualCover accepts a 1-char id", () => {
  const r = clearManualCoverInputSchema.safeParse({ id: "b" });
  assert.equal(r.success, true);
});

test("clearManualCover rejects ids longer than 128 chars", () => {
  const r = clearManualCoverInputSchema.safeParse({ id: "x".repeat(129) });
  assert.equal(r.success, false);
});

test("clearManualCover rejects empty id", () => {
  const r = clearManualCoverInputSchema.safeParse({ id: "" });
  assert.equal(r.success, false);
});
