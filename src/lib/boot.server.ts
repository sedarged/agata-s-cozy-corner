// Agata — boot-time server seeding (§9 polish plan).
//
// `runBootSeeding()` is invoked once on server startup (from `src/server.ts`).
// It is idempotent — running it again is a no-op except for refreshing the
// `provider_sources.configured` flags + `last_checked_at` stamps, so the
// UI's "NYT: niedostępne — brak klucza API" badges stay accurate after a
// `systemctl restart`.
//
// Kept separate from `client.ts` so the unit tests that spin up an in-memory
// DB don't accidentally trigger HTTP-bound seeding code.
import "@tanstack/react-start/server-only";
import { join } from "node:path";
import { getDb, closeDb } from "./db/client";
import { seedProviderSources } from "./db/repositories/provider-sources";

let booted = false;

/**
 * Run all server-side boot seeding. Idempotent in production — calling it
 * more than once in the same process is a no-op (subsequent calls skip
 * migrate + seed). If the DB connection was closed + reopened (e.g. by a
 * unit test that swaps `DATA_DIR`), the boot guard resets so the new DB
 * is also seeded.
 */
export async function runBootSeeding(): Promise<void> {
  const db = getDb();
  if (booted) return;
  booted = true;
  try {
    // Lazy-import drizzle migrator so the SSR pass doesn't need it in
    // its externals list. This module is only reached on the server.
    const { migrate } = await import("drizzle-orm/better-sqlite3/migrator");
    // Migrations first so `provider_sources` exists when we seed it.
    migrate(db, { migrationsFolder: join(process.cwd(), "drizzle") });
    // Then record which social-proof providers are configured at boot.
    seedProviderSources(process.env);
  } catch (err) {
    // Boot seeding must NEVER crash the server — the route layer can
    // fall back to its own safety checks if the seed missed. Reset the
    // flag so the next call retries (e.g. after a transient DB hiccup).
    booted = false;
    closeDb();
    console.error("[boot] seeding failed (will retry on next call):", err);
  }
}

/**
 * Test-only helper: reset the boot guard so a fresh `runBootSeeding()` call
 * will re-run migrate + seed against the current `_sqlite` connection.
 * Production code must NOT call this.
 */
export function __resetBootForTests(): void {
  booted = false;
}
