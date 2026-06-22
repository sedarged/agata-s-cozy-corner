// Apply Drizzle migrations to the DATA_DIR the Playwright webServer is
// about to use. Production runs `npm run db:migrate` explicitly (see
// deploy/README.md); tests do it inline so a fresh sandbox DB has the
// schema the server expects before the first request hits it.
//
// Reads DATA_DIR from env (the same env the webServer inherits). Idempotent
// — drizzle migrator is a no-op when schema is already up to date.
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { drizzle } from "drizzle-orm/better-sqlite3";
import Database from "better-sqlite3";
import { mkdirSync } from "node:fs";
import { join } from "node:path";

const dataDir = process.env.DATA_DIR ?? join(process.cwd(), ".agata-data");
const dbPath = join(dataDir, "agata.db");

mkdirSync(dataDir, { recursive: true });
mkdirSync(join(dataDir, "assets"), { recursive: true });

const sqlite = new Database(dbPath);
sqlite.pragma("journal_mode = WAL");
sqlite.pragma("foreign_keys = ON");
const db = drizzle(sqlite);

migrate(db, { migrationsFolder: join(process.cwd(), "drizzle") });
sqlite.close();

console.log(`[playwright-migrate] ✓ migrations applied to ${dbPath}`);