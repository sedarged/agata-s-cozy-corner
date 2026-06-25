// ErrorScreen.spec.tsx — TDD for src/components/ErrorScreen.tsx (C2).
//
// The top-level ErrorBoundary in `src/routes/__root.tsx` delegates to
// ErrorScreen via TanStack Router's `errorComponent`. The full visual
// rendering of ErrorScreen (with `<Link to="/">`) requires a router
// context, so we pin the renderer-agnostic pieces here and trust the
// router-level wiring test in `src/routes/__root.spec.tsx` for the rest.

import { test } from "node:test";
import assert from "node:assert/strict";

test("ErrorScreen is exported and re-exported via __root errorComponent", async () => {
  // The import alone proves the module compiles and exports the symbol.
  const mod = await import("./ErrorScreen");
  assert.equal(typeof mod.ErrorScreen, "function");
});

test("ErrorScreen is wired into the root errorComponent", async () => {
  // The root route's errorComponent must reference ErrorScreen so uncaught
  // render errors in any child route surface the Polish fallback card
  // instead of white-screening the whole app (C2).
  const fs = await import("node:fs/promises");
  const path = await import("node:path");
  const rootPath = path.join(process.cwd(), "src/routes/__root.tsx");
  const src = await fs.readFile(rootPath, "utf8");
  assert.match(src, /errorComponent:/);
  assert.match(src, /ErrorScreen/);
});
