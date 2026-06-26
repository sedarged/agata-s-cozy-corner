// Doc-style regression tests for vite.config.ts.
//
// These pin the externals list that the rolldown bundler needs to skip.
// Each new shadcn/Radix sub-package added to `src/components/ui/*.tsx`
// must also be added to NITRO_EXTERNAL — otherwise `npm run build` fails
// with "Rolldown failed to resolve import X" at the nitro bundling stage.
//
// Run with: npx tsx --test vite.config.spec.ts

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const source = readFileSync(resolve(here, "vite.config.ts"), "utf8");

test("vite.config.ts externalises @radix-ui/react-slot (shadcn ui/ button, form, sidebar, breadcrumb)", () => {
  assert.match(
    source,
    /"@radix-ui\/react-slot"/,
    "@radix-ui/react-slot must be in NITRO_EXTERNAL or build fails at nitro bundling",
  );
});

test("vite.config.ts externalises class-variance-authority (shadcn ui/ cva)", () => {
  assert.match(
    source,
    /"class-variance-authority"/,
    "class-variance-authority must be in NITRO_EXTERNAL or build fails at nitro bundling",
  );
});

test("vite.config.ts does NOT externalise @radix-ui/react-alert-dialog (deleted in Tasks 8/9/10 refactor)", () => {
  assert.doesNotMatch(
    source,
    /@radix-ui\/react-alert-dialog/,
    "@radix-ui/react-alert-dialog was removed when AlertDialog was replaced with useFocusTrap; do not re-add",
  );
});

test("vite.config.ts keeps @radix-ui/react-popover externalised (still used by Popover components)", () => {
  assert.match(
    source,
    /"@radix-ui\/react-popover"/,
    "@radix-ui/react-popover must remain in NITRO_EXTERNAL",
  );
});
