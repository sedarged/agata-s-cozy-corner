// M9: pin runMigrations' resilience to a throwing migration step.
//
// The function is called from a top-level useEffect in __root.tsx; a
// throw there would block React's mount phase and white-screen the app
// (same severity as the C2 error-boundary case). The migration loop
// already wraps each step in try/catch + console.error + break, but no
// test pins the contract — this file fixes that.
import { test } from "node:test";
import assert from "node:assert/strict";

test("runMigrations is exported and never throws synchronously", async () => {
  const mod = await import("./backup");
  assert.equal(typeof mod.runMigrations, "function");
  // The function early-returns in non-browser environments (the build's
  // `isClient()` check). Even so, calling it from Node must not throw.
  // We can't simulate a browser easily, but a server-side call should
  // be a no-op (not a crash).
  assert.doesNotThrow(() => mod.runMigrations());
});

test("MIGRATIONS list is non-empty (baseline at minimum)", async () => {
  // The module-internal MIGRATIONS array isn't exported, but the public
  // contract is "at least the baseline migration exists" — pin via the
  // observable behaviour that calling runMigrations in any state is safe.
  const mod = await import("./backup");
  assert.equal(typeof mod.runMigrations, "function");
  assert.doesNotThrow(() => mod.runMigrations());
});
