// Mobile + iPad overflow regression tests.
// Asserts that no main route introduces horizontal overflow at phone
// (375) or tablet (820) widths. The Pages render inside a flex column
// with `min-h-dvh`; horizontal overflow usually comes from one of:
//   - Long <select> option text forcing the row wider than the viewport
//   - A chip/tab row without `overflow-x-auto` or `flex-wrap` that
//     escapes the right edge because the inline contents are wider
//     than the available space.
// Failures here usually point to missing `min-w-0 max-w-full` on a
// flex child or a select that's too wide for its row.

import { test, expect } from "@playwright/test";

const ROUTES = [
  "/",
  "/add-book",
  "/notes",
  "/quotes",
  "/statistics",
  "/gigi",
  "/settings",
  "/recommendations",
  "/year-in-review",
];

// Phone + tablet viewports. Mobile portrait = iPhone SE width; tablet
// = iPad Air width. Anything below `lg` is single-column in the app.
const VIEWPORTS = [
  { name: "mobile", width: 375, height: 812 },
  { name: "tablet", width: 820, height: 1180 },
] as const;

test.describe("no horizontal overflow", () => {
  for (const vp of VIEWPORTS) {
    for (const route of ROUTES) {
      test(`${vp.name} ${route} stays within viewport`, async ({ page }) => {
        await page.setViewportSize({ width: vp.width, height: vp.height });
        const res = await page.goto(route);
        expect(res, `${route} did not respond`).not.toBeNull();
        expect(res!.status()).toBeLessThan(500);

        // The app pins body overflow-x to hidden — but that just hides
        // the symptom. The real check: no descendant inside <main> should
        // exceed the viewport width. We compare `documentElement` scroll
        // width to client width.
        const overflow = await page.evaluate(() => ({
          docW: document.documentElement.scrollWidth,
          vpW: document.documentElement.clientWidth,
        }));

        expect(
          overflow.docW,
          `${route} at ${vp.name}: doc.scrollWidth=${overflow.docW} > viewport=${overflow.vpW}`,
        ).toBeLessThanOrEqual(overflow.vpW + 1);
      });
    }
  }
});
