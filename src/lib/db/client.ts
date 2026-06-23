// Agata — better-sqlite3 client + Drizzle wiring. SERVER ONLY.
// The `server-only` guard lives in `index.ts` (the public surface) — keeping
// this file free of side-effect imports so unit tests can spin up the DB.
import Database from "better-sqlite3";
import { drizzle, type BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import * as schema from "./schema";

export type DB = BetterSQLite3Database<typeof schema>;

let _db: DB | undefined;
let _sqlite: Database.Database | undefined;

function dataDir(): string {
  // $DATA_DIR is the canonical location (/var/lib/agata in production).
  // Tests fall back to a per-process scratch dir.
  return process.env.DATA_DIR || join(process.cwd(), ".agata-data");
}

function dbPath(): string {
  return join(dataDir(), "agata.db");
}

function ensureDir(p: string) {
  mkdirSync(p, { recursive: true });
}

export function getDb(): DB {
  if (_db) return _db;
  const dir = dataDir();
  ensureDir(dir);
  ensureDir(join(dir, "assets"));
  const path = dbPath();
  _sqlite = new Database(path);
  _sqlite.pragma("journal_mode = WAL");
  _sqlite.pragma("foreign_keys = ON");
  _sqlite.pragma("synchronous = NORMAL");
  _db = drizzle(_sqlite, { schema });
  return _db;
}

export function getRawSqlite(): Database.Database {
  if (!_sqlite) getDb();
  return _sqlite!;
}

/** For tests / hot-reload — close the connection. */
export function closeDb() {
  if (_sqlite) {
    _sqlite.close();
    _sqlite = undefined;
    _db = undefined;
  }
}

/** Re-export of the resolved path so /api/db-health can report it. */
export function getDbPath(): string {
  return dbPath();
}

export function getDataDir(): string {
  return dataDir();
}

export { schema };
