// Agata — server health for the DB + app. Replaces src/lib/db-status.functions.ts.
import { createServerFn } from "@tanstack/react-start";
import { existsSync, statSync } from "node:fs";
import { join } from "node:path";
import { getDbPath, getDataDir, getDb } from "@/lib/db";

export type ServerHealth = {
  ok: boolean;
  nodeVersion: string;
  platform: string;
  uptime: number;
  timestamp: string;
  dataDir: string;
  dbPath: string;
  dbExists: boolean;
  dbSizeBytes: number;
  assetsDir: string;
  bookCount: number;
  noteCount: number;
  sessionCount: number;
  goalRowExists: boolean;
};

export const getServerHealth = createServerFn({ method: "POST" }).handler(
  async (): Promise<ServerHealth> => {
    const dataDir = getDataDir();
    const dbPath = getDbPath();
    const assetsDir = join(dataDir, "assets");
    const dbExists = existsSync(dbPath);
    const dbSize = dbExists ? statSync(dbPath).size : 0;
    const db = getDb();
    // Cheap count queries — coalesce to a single statement. Drizzle's
    // better-sqlite3 driver types raw strings as `never` to nudge you
    // towards the query builder; we want a raw COUNT, so we cast once at
    // the boundary and let the generic row type carry the result.
    const [{ bookCount }] = db
      .all<{ bookCount: number }>("SELECT COUNT(*) AS bookCount FROM books")
      .map((r) => ({ bookCount: Number(r.bookCount) }));
    const [{ noteCount }] = db
      .all<{ noteCount: number }>("SELECT COUNT(*) AS noteCount FROM notes")
      .map((r) => ({ noteCount: Number(r.noteCount) }));
    const [{ sessionCount }] = db
      .all<{ sessionCount: number }>("SELECT COUNT(*) AS sessionCount FROM reading_sessions")
      .map((r) => ({ sessionCount: Number(r.sessionCount) }));
    const [{ goalRowExists }] = db
      .all<{ goalRowExists: number }>("SELECT COUNT(*) AS goalRowExists FROM goals")
      .map((r) => ({ goalRowExists: Number(r.goalRowExists) }));
    return {
      ok: true,
      nodeVersion: process.version,
      platform: process.platform,
      uptime: Math.round(process.uptime()),
      timestamp: new Date().toISOString(),
      dataDir,
      dbPath,
      dbExists,
      dbSizeBytes: dbSize,
      assetsDir,
      bookCount,
      noteCount,
      sessionCount,
      goalRowExists: goalRowExists > 0,
    };
  },
);
