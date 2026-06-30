// Agata — provider_sources spec.
//
// The `provider_sources` table records which providers are configured
// (env-gated at boot). The UI uses this to surface "NYT: niedostępne —
// brak klucza API" instead of silently 404'ing in the cache layer.
//
// Pin: schema columns + the seedAtBoot helper's contract.
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import * as dbClient from "@/lib/db/client";
import { listProviderSources, seedProviderSources } from "./provider-sources";

let dataDir: string;
let prevDataDir: string | undefined;

test.before(() => {
  prevDataDir = process.env.DATA_DIR;
  dataDir = mkdtempSync(join(tmpdir(), "agata-prov-"));
  process.env.DATA_DIR = dataDir;
  migrate(dbClient.getDb(), { migrationsFolder: join(process.cwd(), "drizzle") });
});

test.after(() => {
  dbClient.closeDb();
  process.env.DATA_DIR = prevDataDir;
  if (existsSync(dataDir)) rmSync(dataDir, { recursive: true, force: true });
});

test.beforeEach(() => {
  dbClient.getRawSqlite().exec("DELETE FROM provider_sources;");
});

test("seedProviderSources writes one row per known provider", () => {
  const env: Record<string, string | undefined> = {
    HARDCOVER_TOKEN: "tok",
    NYT_API_KEY: undefined,
    LIBRARYTHING_TOKEN: undefined,
  };
  seedProviderSources(env);
  const rows = listProviderSources();
  const hardcover = rows.find((r) => r.source === "hardcover");
  const nyt = rows.find((r) => r.source === "nyt");
  const lt = rows.find((r) => r.source === "libraryThing");
  assert.ok(hardcover && nyt && lt);
  assert.equal(hardcover.configured, true);
  assert.equal(nyt.configured, false);
  assert.equal(lt.configured, false);
  // last_checked_at is stamped to a parseable timestamp.
  assert.ok(nyt.lastCheckedAt && !Number.isNaN(Date.parse(nyt.lastCheckedAt)));
});

test("seedProviderSources is idempotent — running twice keeps the configured flag", () => {
  const env: Record<string, string | undefined> = { HARDCOVER_TOKEN: "tok" };
  seedProviderSources(env);
  seedProviderSources({}); // second pass: unconfigured
  const hardcover = listProviderSources().find((r) => r.source === "hardcover");
  assert.equal(hardcover?.configured, false);
});
