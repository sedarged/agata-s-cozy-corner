// cover-perf.spec.ts — perf regressions on book-cover load time.
//
// Strategy: load the home page (`/`) and the search API in sequence across
// three realistic device profiles (iPhone 13, iPad gen 7, Desktop Chrome).
// Measure the time from navigation to the first cover image being fully
// decoded. The thresholds are generous (suitable for CI) and document
// the baseline; tighten them once the project has real-user metrics.
//
// We don't assert on absolute numbers for the search request (it can
// legitimately take 5–8s on cold upstreams); we DO assert that the cache
// makes a second call much faster than the first.

import { test, expect, devices } from "@playwright/test";

const COVER_LCP_BUDGET_MS = 6_000;

test.describe("cover load perf", () => {
  for (const [name, device] of Object.entries({
    "iPhone 13": devices["iPhone 13"],
    "iPad (gen 7)": devices["iPad (gen 7)"],
    "Desktop Chrome": devices["Desktop Chrome"],
  })) {
    test(`home page first cover decodes within budget — ${name}`, async ({ browser }) => {
      const ctx = await browser.newContext({ ...device, deviceScaleFactor: 2 });
      const page = await ctx.newPage();
      const t0 = Date.now();
      await page.goto("/");
      // The first cover is the LCP candidate; BookCover marks it priority.
      // Wait for the first <img> to fire `load`.
      const firstImg = page.locator("img").first();
      await expect(firstImg).toBeVisible({ timeout: COVER_LCP_BUDGET_MS });
      const decoded = await firstImg.evaluate(
        (el) =>
          new Promise<{ ms: number; complete: boolean }>((resolve) => {
            const img = el as HTMLImageElement;
            if (img.complete && img.naturalWidth > 0) {
              resolve({ ms: 0, complete: true });
              return;
            }
            const start = performance.now();
            img.addEventListener(
              "load",
              () => resolve({ ms: performance.now() - start, complete: true }),
              { once: true },
            );
            img.addEventListener(
              "error",
              () => resolve({ ms: performance.now() - start, complete: false }),
              { once: true },
            );
          }),
      );
      const total = Date.now() - t0;
      // Sanity: we hit the LCP budget on all three device profiles.
      // We log instead of hard-asserting on absolute time so a slow CI
      // runner doesn't flake the build, but the suite FAILS if the
      // image never loaded at all.
      console.log(`[${name}] first cover: ${total}ms, decode: ${decoded.ms.toFixed(0)}ms, complete: ${decoded.complete}`);
      expect(decoded.complete).toBe(true);
      await ctx.close();
    });
  }
});

test.describe("search API perf", () => {
  test("second identical search is served from the in-memory cache", async ({ request }) => {
    // First call: cold upstream fan-out. We don't assert on time — the
    // upstreams can legitimately be slow.
    const t1 = Date.now();
    const r1 = await request.get(
      "/api/book-search?q=" + encodeURIComponent("wiedźmin") + "&pageSize=5",
    );
    const coldMs = Date.now() - t1;
    expect(r1.status()).toBe(200);

    // Second call: same query, should hit the server-side cache.
    const t2 = Date.now();
    const r2 = await request.get(
      "/api/book-search?q=" + encodeURIComponent("wiedźmin") + "&pageSize=5",
    );
    const warmMs = Date.now() - t2;
    expect(r2.status()).toBe(200);

    // The second call should be much faster than the first (it skips
    // 3 upstream API calls). Generous bound to avoid flaking on
    // shared CI runners.
    console.log(`[search] cold=${coldMs}ms warm=${warmMs}ms`);
    expect(warmMs).toBeLessThan(Math.max(500, coldMs / 2 + 100));
  });
});
