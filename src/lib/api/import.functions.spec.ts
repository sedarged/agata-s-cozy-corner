// Agata — integration tests for the backup-import server functions.
// Spins up a tmpdir DB with migrations, then exercises preview + merge + replace.
import { after, before, beforeEach, describe, it } from "node:test";
import { mkdtempSync, rmSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import assert from "node:assert/strict";

import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { getTableName } from "drizzle-orm";

import * as dbClient from "@/lib/db/client";
import {
  assets,
  books as booksTbl,
  goals,
  notes,
  notesDeleted,
  readingSessions,
  settings,
} from "@/lib/db/schema";
import * as importApi from "@/lib/api/import.functions";
import * as notesRepo from "@/lib/db/repositories/notes";

let dataDir: string;
let prevDataDir: string | undefined;

before(() => {
  prevDataDir = process.env.DATA_DIR;
  dataDir = mkdtempSync(join(tmpdir(), "agata-import-test-"));
  process.env.DATA_DIR = dataDir;
  migrate(dbClient.getDb(), { migrationsFolder: join(process.cwd(), "drizzle") });
});

after(() => {
  dbClient.closeDb();
  process.env.DATA_DIR = prevDataDir;
  if (existsSync(dataDir)) rmSync(dataDir, { recursive: true, force: true });
});

beforeEach(() => {
  const sqlite = dbClient.getRawSqlite();
  for (const name of [assets, notesDeleted, notes, readingSessions, goals, settings, booksTbl].map(
    getTableName,
  )) {
    sqlite.exec(`DELETE FROM ${name};`);
  }
});

function payloadWith(overrides: Record<string, unknown>) {
  return {
    payload: {
      app: "agata" as const,
      schemaVersion: 1,
      exportedAt: new Date().toISOString(),
      data: {
        books: { localBooks: [], overrides: {}, deletedIds: [] },
        bookState: {},
        readingSessions: [],
        notes: [],
        notesDeleted: [],
        ...overrides,
      },
    },
  };
}

describe("previewImport", () => {
  it("returns counts without writing", async () => {
    const r = await importApi.previewImport({
      data: {
        payload: payloadWith({
          books: { localBooks: [{ id: "b1", title: "X" }], overrides: {}, deletedIds: [] },
          notes: [{ id: "n1" }, { id: "n2" }],
        }).payload,
        mode: "preview",
      },
    });
    assert.equal(r.books, 1);
    assert.equal(r.notes, 2);
    // No write happened.
    const sqlite = dbClient.getRawSqlite();
    assert.equal(sqlite.prepare("SELECT COUNT(*) AS c FROM books").get(), { c: 0 });
  });
});

describe("applyImport (merge)", () => {
  it("upserts books, notes, sessions and goals", async () => {
    const r = await importApi.applyImport({
      data: {
        payload: payloadWith({
          books: {
            localBooks: [{ id: "b1", title: "Lalka", author: "Prus" }],
            overrides: {},
            deletedIds: [],
          },
          notes: [{ id: "n1", bookId: "b1", type: "quote" }],
          readingSessions: [
            {
              id: "s1",
              bookId: "b1",
              date: "2026-06-21",
              minutes: 30,
              pagesRead: 10,
              startPage: 0,
              endPage: 10,
            },
          ],
          goals: { yearlyBooks: 30, weeklyMinutes: 300 },
        }).payload,
        mode: "merge",
      },
    });
    assert.equal(r.ok, true);
    assert.equal(r.counts.books, 1);
    assert.equal(r.counts.notes, 1);
    assert.equal(r.counts.sessions, 1);
    assert.equal(r.counts.goals, 1);

    const sqlite = dbClient.getRawSqlite();
    assert.equal(sqlite.prepare("SELECT COUNT(*) AS c FROM books").get(), { c: 1 });
    assert.equal(sqlite.prepare("SELECT COUNT(*) AS c FROM notes").get(), { c: 1 });
    assert.equal(sqlite.prepare("SELECT COUNT(*) AS c FROM reading_sessions").get(), { c: 1 });
    const g = sqlite.prepare("SELECT yearly_books AS y, weekly_minutes AS w FROM goals").get() as {
      y: number;
      w: number;
    };
    assert.equal(g.y, 30);
    assert.equal(g.w, 300);
  });

  it("is idempotent on repeated merge (upserts, not duplicates)", async () => {
    const data = payloadWith({
      books: {
        localBooks: [{ id: "b1", title: "X", author: "A" }],
        overrides: {},
        deletedIds: [],
      },
    }).payload;
    await importApi.applyImport({ data: { payload: data, mode: "merge" } });
    await importApi.applyImport({ data: { payload: data, mode: "merge" } });
    const sqlite = dbClient.getRawSqlite();
    assert.equal(sqlite.prepare("SELECT COUNT(*) AS c FROM books").get(), { c: 1 });
  });

  it("skips invalid rows without throwing", async () => {
    const r = await importApi.applyImport({
      data: {
        payload: {
          app: "agata",
          schemaVersion: 1,
          data: {
            books: {
              localBooks: [{ id: "good", title: "OK" }, { author: "no-id-no-title" }],
            },
          },
        },
        mode: "merge",
      },
    });
    assert.equal(r.ok, true);
    assert.equal(r.counts.books, 1);
  });
});

describe("applyImport (replace)", () => {
  it("wipes existing books + notes + sessions before importing", async () => {
    // Seed the DB with one of each.
    const sqlite = dbClient.getRawSqlite();
    sqlite.exec(
      `INSERT INTO books (id, title, author) VALUES ('old', 'Stara', 'X');` +
        `INSERT INTO notes (id, book_id, type, created_at, updated_at) VALUES ('old-n', 'old', 'note', '2026-01-01', '2026-01-01');` +
        `INSERT INTO notes_deleted (id) VALUES ('old-n');` +
        `INSERT INTO reading_sessions (id, book_id, date, minutes, pages_read, start_page, end_page, created_at, updated_at) VALUES ('old-s', 'old', '2026-01-01', 1, 0, 0, 0, '2026-01-01', '2026-01-01');`,
    );

    const r = await importApi.applyImport({
      data: {
        payload: payloadWith({
          books: {
            localBooks: [{ id: "new", title: "Nowa", author: "Y" }],
            overrides: {},
            deletedIds: [],
          },
          notes: [{ id: "new-n", bookId: "new", type: "quote" }],
          readingSessions: [
            {
              id: "new-s",
              bookId: "new",
              date: "2026-06-21",
              minutes: 5,
              pagesRead: 0,
              startPage: 0,
              endPage: 0,
            },
          ],
        }).payload,
        mode: "replace",
      },
    });
    assert.equal(r.ok, true);
    assert.equal(r.counts.books, 1);
    assert.equal(r.counts.notes, 1);
    assert.equal(r.counts.sessions, 1);

    assert.equal(sqlite.prepare("SELECT COUNT(*) AS c FROM books").get(), { c: 1 });
    assert.equal(sqlite.prepare("SELECT id AS i FROM books").get(), { i: "new" });
    assert.equal(sqlite.prepare("SELECT COUNT(*) AS c FROM notes").get(), { c: 1 });
    assert.equal(sqlite.prepare("SELECT COUNT(*) AS c FROM reading_sessions").get(), { c: 1 });
    // Replace-mode bulk-deletes notes + their tombstones so no ghost rows leak.
    assert.equal(sqlite.prepare("SELECT COUNT(*) AS c FROM notes_deleted").get(), { c: 0 });
  });

  it("applies notesDeleted (tombstones) from the payload", async () => {
    // Seed: one book, no notes.
    const sqlite = dbClient.getRawSqlite();
    sqlite.exec(`INSERT INTO books (id, title, author) VALUES ('b1', 'B', 'A');`);

    await importApi.applyImport({
      data: {
        payload: payloadWith({
          notesDeleted: ["ghost-1", "ghost-2"],
        }).payload,
        mode: "merge",
      },
    });
    const tombstones = sqlite.prepare("SELECT id FROM notes_deleted ORDER BY id").all() as {
      id: string;
    }[];
    assert.deepEqual(
      tombstones.map((t) => t.id),
      ["ghost-1", "ghost-2"],
    );
  });
});

describe("applyImport (drafts + handwritingPrefs)", () => {
  it("persists drafts and handwriting prefs to the settings table", async () => {
    await importApi.applyImport({
      data: {
        payload: {
          app: "agata",
          schemaVersion: 1,
          data: {
            noteDrafts: { "agata-note-draft-a": { content: "x" } },
            handwritingPrefs: { colour: "navy" },
          },
        },
        mode: "merge",
      },
    });
    const sqlite = dbClient.getRawSqlite();
    const rows = sqlite.prepare("SELECT key AS k, value AS v FROM settings").all() as {
      k: string;
      v: string;
    }[];
    const keys = rows.map((r) => r.k).sort();
    assert.deepEqual(keys, ["agata.imported.drafts", "agata.imported.handwritingPrefs"]);
  });

  it("filters drafts to keys with the legacy `agata-note-draft-` prefix", async () => {
    await importApi.applyImport({
      data: {
        payload: {
          app: "agata",
          schemaVersion: 1,
          data: {
            // ad-hoc key should be dropped from the persisted drafts map.
            noteDrafts: {
              "agata-note-draft-a": { content: "x" },
              "rogue-key": "should-not-appear",
            },
          },
        },
        mode: "merge",
      },
    });
    const sqlite = dbClient.getRawSqlite();
    const row = sqlite
      .prepare("SELECT value AS v FROM settings WHERE key = 'agata.imported.drafts'")
      .get() as { v: string };
    const stored = JSON.parse(row.v) as Record<string, unknown>;
    assert.ok("agata-note-draft-a" in stored, "legit draft kept");
    assert.ok(!("rogue-key" in stored), "rogue key filtered out");
  });
});

// Smoke test: tombstone via notesDeleted preserves a deleted id.
describe("notesRepo.deleteNote", () => {
  it("tombstones the id so it can be restored", async () => {
    await notesRepo.createNote({ id: "n1", bookId: "b1", type: "quote" });
    const ok = await notesRepo.deleteNote("n1");
    assert.equal(ok, true);
    const sqlite = dbClient.getRawSqlite();
    const t = sqlite.prepare("SELECT id FROM notes_deleted").get() as { id: string } | undefined;
    assert.equal(t?.id, "n1");
  });
});
