// Integration test for the DB layer (migrations + repositories).
// Uses node:test (built-in) + tsx. Run with: npm test
//
// Strategy: spin up ONE tmpdir + ONE DB connection for the whole file, run
// migrations once in `before`, and `DELETE FROM` every table in `beforeEach`.
// Module-level singletons stay intact (no cache-busting dance).
import { after, before, beforeEach, describe, it } from "node:test";
import { mkdtempSync, rmSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import assert from "node:assert/strict";

import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { getTableName } from "drizzle-orm";

import * as dbClient from "./client";
import * as books from "./repositories/books";
import * as notesRepo from "./repositories/notes";
import * as sessionsRepo from "./repositories/reading-sessions";
import * as goalsSettings from "./repositories/goals";
import * as assetsRepo from "./repositories/assets";
import {
  assets,
  books as booksTbl,
  goals,
  notes,
  notesDeleted,
  readingSessions,
  settings,
} from "./schema";

let dataDir: string;
let prevDataDir: string | undefined;

before(() => {
  prevDataDir = process.env.DATA_DIR;
  dataDir = mkdtempSync(join(tmpdir(), "agata-db-test-"));
  process.env.DATA_DIR = dataDir;
  // Apply migrations once.
  migrate(dbClient.getDb(), { migrationsFolder: join(process.cwd(), "drizzle") });
});

after(() => {
  dbClient.closeDb();
  process.env.DATA_DIR = prevDataDir;
  if (existsSync(dataDir)) rmSync(dataDir, { recursive: true, force: true });
});

beforeEach(() => {
  // Wipe all rows so each test starts from a clean state.
  const sqlite = dbClient.getRawSqlite();
  const tables = [assets, notesDeleted, notes, readingSessions, goals, settings, booksTbl].map(
    getTableName,
  );
  // Children before parents (FK ON DELETE CASCADE handles it, but be explicit).
  for (const name of tables) sqlite.exec(`DELETE FROM ${name};`);
});

describe("books repo", () => {
  it("creates and reads a book", async () => {
    const b = await books.upsertBook({ id: "local-1", title: "Lalka", author: "Prus" });
    assert.equal(b.title, "Lalka");
    assert.equal(b.status, "queue");
    assert.equal(b.id, "local-1");
    const got = await books.getBook("local-1");
    assert.ok(got);
    assert.equal(got!.author, "Prus");
  });

  it("upsert updates an existing book", async () => {
    await books.upsertBook({ id: "local-2", title: "A", author: "X" });
    const updated = await books.upsertBook({
      id: "local-2",
      title: "A2",
      author: "X",
      currentPage: 100,
    });
    assert.equal(updated.title, "A2");
    assert.equal(updated.currentPage, 100);
  });

  it("patches a book", async () => {
    await books.upsertBook({ id: "local-3", title: "T", author: "A" });
    const patched = await books.patchBook("local-3", { status: "reading", currentPage: 50 });
    assert.equal(patched?.status, "reading");
    assert.equal(patched?.currentPage, 50);
  });

  it("bumpCurrentPage is monotonic", async () => {
    await books.upsertBook({ id: "local-4", title: "T", author: "A" });
    await books.bumpCurrentPage("local-4", 100);
    await books.bumpCurrentPage("local-4", 50); // no-op
    const got = await books.getBook("local-4");
    assert.equal(got?.currentPage, 100);
  });

  it("deletes a book", async () => {
    await books.upsertBook({ id: "local-5", title: "T", author: "A" });
    const ok = await books.deleteBook("local-5");
    assert.equal(ok, true);
    const got = await books.getBook("local-5");
    assert.equal(got, undefined);
  });

  it("lists books ordered by addedAt desc", async () => {
    await books.upsertBook({ id: "local-6", title: "First", author: "A" });
    await new Promise((r) => setTimeout(r, 10));
    await books.upsertBook({ id: "local-7", title: "Second", author: "A" });
    const all = await books.listBooks();
    assert.equal(all.length, 2);
    assert.equal(all[0].id, "local-7");
  });

  it("searchBooks finds by title or author", async () => {
    await books.upsertBook({ id: "local-8", title: "Wiedźmin", author: "Sapkowski" });
    await books.upsertBook({ id: "local-9", title: "Lalka", author: "Prus" });
    const byAuthor = await books.searchBooks("Sapk");
    assert.equal(byAuthor.length, 1);
    assert.equal(byAuthor[0].id, "local-8");
  });
});

describe("notes repo", () => {
  beforeEach(async () => {
    await books.upsertBook({ id: "local-b1", title: "B", author: "X" });
  });

  it("creates a note attached to a book", async () => {
    const n = await notesRepo.createNote({
      id: "note-1",
      bookId: "local-b1",
      type: "quote",
      content: "",
      quoteText: "Great line",
    });
    assert.equal(n.bookId, "local-b1");
    assert.equal(n.quoteText, "Great line");
  });

  it("cascades delete with book", async () => {
    await notesRepo.createNote({ id: "note-2", bookId: "local-b1", type: "note", content: "x" });
    await books.deleteBook("local-b1");
    const all = await notesRepo.listNotesForBook("local-b1");
    assert.equal(all.length, 0);
  });

  it("tombstones a deleted note", async () => {
    await notesRepo.createNote({ id: "note-3", bookId: "local-b1", type: "note", content: "x" });
    await notesRepo.deleteNote("note-3");
    const deleted = await notesRepo.listDeletedNoteIds();
    assert.ok(deleted.includes("note-3"));
  });

  it("patches a note", async () => {
    await notesRepo.createNote({ id: "note-4", bookId: "local-b1", type: "note", content: "x" });
    const patched = await notesRepo.patchNote("note-4", { content: "updated" });
    assert.equal(patched?.content, "updated");
  });
});

describe("reading_sessions repo", () => {
  beforeEach(async () => {
    await books.upsertBook({ id: "local-b2", title: "B", author: "X" });
  });

  it("creates a session and orders by date desc", async () => {
    await sessionsRepo.createSession({
      id: "rs-1",
      bookId: "local-b2",
      date: "2026-01-01",
      minutes: 30,
      pagesRead: 10,
      startPage: 1,
      endPage: 11,
    });
    await sessionsRepo.createSession({
      id: "rs-2",
      bookId: "local-b2",
      date: "2026-01-15",
      minutes: 45,
      pagesRead: 20,
      startPage: 11,
      endPage: 31,
    });
    const list = await sessionsRepo.listSessionsForBook("local-b2");
    assert.equal(list[0].id, "rs-2");
    assert.equal(list[1].id, "rs-1");
  });

  it("patches and recalculates pagesRead", async () => {
    await sessionsRepo.createSession({
      id: "rs-3",
      bookId: "local-b2",
      date: "2026-01-01",
      minutes: 30,
      pagesRead: 0,
      startPage: 1,
      endPage: 11,
    });
    const p = await sessionsRepo.patchSession("rs-3", { startPage: 1, endPage: 25 });
    assert.equal(p?.pagesRead, 24);
  });

  it("filters between dates", async () => {
    await sessionsRepo.createSession({
      id: "rs-4",
      bookId: "local-b2",
      date: "2025-12-31",
      minutes: 10,
      pagesRead: 1,
      startPage: 1,
      endPage: 2,
    });
    await sessionsRepo.createSession({
      id: "rs-5",
      bookId: "local-b2",
      date: "2026-06-15",
      minutes: 10,
      pagesRead: 1,
      startPage: 1,
      endPage: 2,
    });
    const between = await sessionsRepo.listSessionsBetween("2026-01-01", "2026-12-31");
    assert.equal(between.length, 1);
    assert.equal(between[0].id, "rs-5");
  });
});

describe("goals + settings repo", () => {
  it("getGoals seeds defaults on first call", async () => {
    const g = await goalsSettings.getGoals();
    assert.equal(g.yearlyBooks, 24);
    assert.equal(g.weeklyMinutes, 210);
  });

  it("setGoals updates values", async () => {
    const g = await goalsSettings.setGoals({ yearlyBooks: 50, weeklyMinutes: 300 });
    assert.equal(g.yearlyBooks, 50);
    assert.equal(g.weeklyMinutes, 300);
  });

  it("settings get/set roundtrip", async () => {
    await goalsSettings.setSetting("gigi_privacy", "full");
    const got = await goalsSettings.getSetting<string>("gigi_privacy");
    assert.equal(got, "full");
  });

  it("settings can store structured objects", async () => {
    const obj = { theme: "dark", accent: "rose" };
    await goalsSettings.setSetting("ui", obj);
    const got = await goalsSettings.getSetting<typeof obj>("ui");
    assert.deepEqual(got, obj);
  });
});

describe("assets repo", () => {
  it("writes a file to assets/ and dedupes by sha256", async () => {
    const bytes = Buffer.from("hello world");
    const a1 = await assetsRepo.putAsset({
      id: "a-1",
      filename: "hello.txt",
      mime: "text/plain",
      bytes,
    });
    const a2 = await assetsRepo.putAsset({
      id: "a-2",
      filename: "hello-copy.txt",
      mime: "text/plain",
      bytes,
    });
    // Same sha256 → second call returns the first row.
    assert.equal(a1.sha256, a2.sha256);
    assert.equal(a1.id, a2.id);
    const got = await assetsRepo.readAssetBytes("a-1");
    assert.ok(got);
    assert.equal(got!.bytes.toString(), "hello world");
  });

  it("deletes metadata and file", async () => {
    await assetsRepo.putAsset({
      id: "a-3",
      filename: "x.bin",
      mime: "application/octet-stream",
      bytes: Buffer.from([1, 2, 3]),
    });
    const ok = await assetsRepo.deleteAsset("a-3");
    assert.equal(ok, true);
    const got = await assetsRepo.getAsset("a-3");
    assert.equal(got, undefined);
  });
});
