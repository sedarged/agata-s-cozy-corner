// H6: pin the contract of resolveMutationErrorMessage.
//
// Every silent `catch {}` block in the read routes now routes here, so we
// must guarantee (a) an Error's message wins, (b) non-Error throws get the
// Polish fallback, (c) empty Error messages fall back to the Polish string
// (defensive — sonner would render an empty toast otherwise).
//
// The function is intentionally PURE (returns the resolved message) so
// tests don't need to mock `sonner` — the caller wraps it in toast.error.
import { test } from "node:test";
import assert from "node:assert/strict";
import { resolveMutationErrorMessage } from "./notify-mutation-error";

test("resolveMutationErrorMessage surfaces an Error's message", () => {
  assert.equal(resolveMutationErrorMessage(new Error("nope"), "fallback"), "nope");
});

test("resolveMutationErrorMessage falls back when err is not an Error", () => {
  for (const v of ["string thrown", { code: 500 }, undefined, null, 42]) {
    assert.equal(resolveMutationErrorMessage(v, "Nie udało się zapisać"), "Nie udało się zapisać");
  }
});

test("resolveMutationErrorMessage falls back when Error.message is empty", () => {
  assert.equal(
    resolveMutationErrorMessage(new Error(""), "Nie udało się zapisać"),
    "Nie udało się zapisać",
  );
});
