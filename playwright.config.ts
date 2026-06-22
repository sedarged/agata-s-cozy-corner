// Playwright config for Agata end-to-end tests.
//
// Strategy:
//   - Reuse the system Chrome (/usr/bin/google-chrome) — the official
//     Playwright/Chromium download is ~150MB and the headless-shell
//     download is rate-limited / partial in this sandbox. System Chrome
//     is stable on Linux VPSes that already have it installed.
//   - Spin up the production build (`npm run preview`) which serves the
//     pre-built `.output/` so the e2e tests exercise the same JS that
//     ships to the VPS, not the Vite dev server with HMR and source
//     transforms. webServer auto-starts/stops it for each run.
//   - Use a dedicated DATA_DIR per test worker so tests don't share
//     SQLite WAL state with the dev server or each other.
import { defineConfig, devices } from "@playwright/test";

const PORT = Number(process.env.E2E_PORT ?? 4173);
const BASE_URL = `http://127.0.0.1:${PORT}`;

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false, // SQLite single-file; serialise to avoid races
  workers: 1,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? "line" : "list",
  timeout: 30_000,
  expect: { timeout: 5_000 },
  use: {
    baseURL: BASE_URL,
    headless: true,
    screenshot: "only-on-failure",
    video: "retain-on-failure",
    trace: "retain-on-failure",
    // Reuse the system Chrome — see header comment.
    launchOptions: {
      executablePath: process.env.PLAYWRIGHT_CHROMIUM ?? "/usr/bin/google-chrome",
    },
  },
  projects: [
    {
      name: "chromium-system",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: {
    command: `npm run preview -- --port ${PORT} --strictPort`,
    url: BASE_URL,
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
    stdout: "pipe",
    stderr: "pipe",
    env: {
      DATA_DIR: process.env.E2E_DATA_DIR ?? "/tmp/agata-e2e-data",
      HOST: "127.0.0.1",
      PORT: String(PORT),
    },
  },
});