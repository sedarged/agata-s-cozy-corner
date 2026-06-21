// Agata — server health for the DB + app. Replaces src/lib/db-status.functions.ts.
import { createServerFn } from "@tanstack/react-start";
import { existsSync, statSync } from "node:fs";
import { join } from "node:path";
import { getDbPath, getDataDir, getDb, getRawSqlite } from "@/lib/db";

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
    // Cheap count queries — coalesce to a single statement.
    const [{ bookCount }] = db.all<{ bookCount: number }[]>(
      "SELECT COUNT(*) AS bookCount FROM books" as never,
    ) as unknown as { bookCount: number }[];
    const [{ noteCount }] = db.all<{ noteCount: number }[]>(
      "SELECT COUNT(*) AS noteCount FROM notes" as never,
    ) as unknown as { noteCount: number }[];
    const [{ sessionCount }] = db.all<{ sessionCount: number }[]>(
      "SELECT COUNT(*) AS sessionCount FROM reading_sessions" as never,
    ) as unknown as { sessionCount: number }[];
    const [{ goalRowExists }] = db.all<{ goalRowExists: number }[]>(
      "SELECT COUNT(*) AS goalRowExists FROM goals" as never,
    ) as unknown as { goalRowExists: number }[];
    void getRawSqlite(); // keep the linter quiet about unused export in this file.
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
