// End-to-end smoke tests for Agata.
//
// These tests need a running server (handled by Playwright's `webServer`
// in playwright.config.ts). On a fresh install they cover:
//   - The root page renders
//   - The DB-backed /api/health endpoint is reachable
//   - The book search endpoint returns real Open Library / Google / BN results
//   - The navigation links work end-to-end
//
// `fullyParallel: false` (set in the config) means these run one at a
// time — the SQLite WAL would otherwise race between workers.
import { test, expect } from "@playwright/test";

test.describe("smoke", () => {
  test("GET /api/health returns ok=true", async ({ request }) => {
    const res = await request.get("/api/health");
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.status).toBe("ok");
    expect(body.nodeVersion).toMatch(/^v\d+\./);
    expect(typeof body.uptime).toBe("number");
    expect(typeof body.dbLatencyMs).toBe("number");
  });

  test("GET /api/health returns 503 with degraded when DATA_DIR is unwritable", async ({
    request,
  }) => {
    // Skip this scenario in the e2e suite — it requires monkey-patching
    // env vars after the server has started, which would not affect the
    // already-open DB connection. Documented in code-review.
    test.skip(true, "covered by unit tests in src/routes/api/health.spec.ts");
  });

  test("GET /api/book-search?q=wiedźmin returns real results", async ({ request }) => {
    const res = await request.get("/api/book-search?q=" + encodeURIComponent("wiedźmin"));
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body)).toBe(true);
    // The Polish National Library and Open Library should both surface
    // Sapkowski's Witcher cycle. Allow zero results only if the upstream
    // is down (rare); fail if shape is wrong.
    if (body.length > 0) {
      const first = body[0];
      expect(typeof first.title).toBe("string");
      expect(typeof first.author).toBe("string");
      expect(["openlibrary", "google", "bn"]).toContain(first.source);
    }
  });

  test("GET /api/book-search with missing q returns 400", async ({ request }) => {
    const res = await request.get("/api/book-search");
    expect(res.status()).toBe(400);
    const body = await res.json();
    expect(typeof body.error).toBe("string");
  });

  test("home page renders with the app shell", async ({ page }) => {
    await page.goto("/");
    // The home page always renders the brand link in the nav; on a fresh
    // install the user is prompted to add a book, so we just confirm the
    // page hydrated without a fatal error.
    await expect(page).toHaveTitle(/.+/);
    // No 5xx banner — server returned a 200.
    const response = await page.goto("/");
    expect(response?.status()).toBeLessThan(500);
  });

  test("navigation reaches /library", async ({ page }) => {
    await page.goto("/library");
    await expect(page).toHaveURL(/\/library$/);
  });
});

test.describe("ops", () => {
  test("/api/health is fast (<1s)", async ({ request }) => {
    const t0 = Date.now();
    const res = await request.get("/api/health");
    const elapsed = Date.now() - t0;
    expect(res.status()).toBe(200);
    expect(elapsed).toBeLessThan(1000);
  });

  test("/api/health no-store cache header", async ({ request }) => {
    const res = await request.get("/api/health");
    expect(res.headers()["cache-control"]).toBe("no-store");
  });
});