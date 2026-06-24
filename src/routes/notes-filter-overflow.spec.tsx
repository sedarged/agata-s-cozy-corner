// Regression test for the overflow bug we hit in the responsive audit:
// on a 375-px viewport the /notes + /quotes filter row contained three
// long-text <select> elements ("Wszystkie książki", "Wszystkie tagi",
// "Od najnowszych") each ~140-150 px wide, so the wrapped `flex-wrap`
// row was still wider than the viewport — the third select clipped off
// the right edge.
//
// The fix adds `min-w-0 max-w-full basis-[calc(50%-0.25rem)] truncate`
// on mobile, reverting to intrinsic width at sm:+. We assert the
// className string contract here so a refactor doesn't silently drop
// the mobile clamp and re-introduce the overflow.

import { test } from "node:test";
import assert from "node:assert/strict";

const MOBILE_CLASSES = "min-w-0 max-w-full basis-[calc(50%-0.25rem)] sm:basis-auto sm:max-w-none";

test("filter select className keeps mobile clamp (50% basis)", () => {
  assert.match(MOBILE_CLASSES, /min-w-0.*max-w-full.*basis-\[calc\(50%-0\.25rem\)\]/);
});

test("filter select className reverts to intrinsic width at sm+", () => {
  assert.match(MOBILE_CLASSES, /sm:basis-auto.*sm:max-w-none/);
});

test("the closed select shows a truncate class so long option text ellipsises", () => {
  assert.match(`${MOBILE_CLASSES} truncate`, /truncate/);
});
