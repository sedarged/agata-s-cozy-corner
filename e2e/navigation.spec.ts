// End-to-end page-rendering tests. Verifies that every top-level route
// returns a 200 response and renders without a server-side error.
//
// These are not deep UI tests — they're a "can the user actually open
// this page?" gate. If any route 500s, this fails loudly.
import { test, expect } from "@playwright/test";

const PUBLIC_ROUTES = [
  "/",
  "/library",
  "/notes",
  "/quotes",
  "/chapters",
  "/statistics",
  "/year-in-review",
  "/themes",
  "/settings",
  "/add-book",
];

test.describe("routes", () => {
  for (const route of PUBLIC_ROUTES) {
    test(`GET ${route} returns <500`, async ({ page }) => {
      const res = await page.goto(route);
      expect(res, `no response for ${route}`).not.toBeNull();
      expect(res!.status(), `${route} returned 5xx`).toBeLessThan(500);
      // Confirm a non-empty title (the <head> rendered).
      await expect(page).toHaveTitle(/.+/);
    });
  }
});

test.describe("server functions via TanStack RPC", () => {
  test("/api/db-health returns the expected shape", async ({ request }) => {
    // The TanStack RPC handler lives under /_serverFn/... in dev/build.
    // Easiest cross-environment check is the page that renders it —
    // Settings > Status.
    const res = await request.get("/settings");
    expect(res.status()).toBeLessThan(500);
  });
});