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
import * as chatsRepo from "./repositories/chats";
import * as handwritingRepo from "./repositories/handwriting";
import {
  assets,
  books as booksTbl,
  chatMessages,
  chatSessions,
  goals,
  handwritingPages,
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
  const tables = [
    assets,
    chatMessages,
    chatSessions,
    handwritingPages,
    notesDeleted,
    notes,
    readingSessions,
    goals,
    settings,
    booksTbl,
  ].map(getTableName);
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

  it("deleteAllBooks wipes every row and returns the deleted count", async () => {
    await books.upsertBook({ id: "local-10", title: "A", author: "X" });
    await books.upsertBook({ id: "local-11", title: "B", author: "Y" });
    await books.upsertBook({ id: "local-12", title: "C", author: "Z" });
    const wiped = await books.deleteAllBooks();
    assert.equal(wiped, 3);
    const all = await books.listBooks();
    assert.equal(all.length, 0);
  });

  it("deleteAllBooks returns 0 on an empty table", async () => {
    const wiped = await books.deleteAllBooks();
    assert.equal(wiped, 0);
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

  it("markNoteDeleted tombstones without touching a live note", async () => {
    await notesRepo.createNote({ id: "note-5", bookId: "local-b1", type: "note", content: "x" });
    await notesRepo.markNoteDeleted("note-5");
    const live = await notesRepo.getNote("note-5");
    assert.ok(live, "live note untouched");
    const tombstones = await notesRepo.listDeletedNoteIds();
    assert.ok(tombstones.includes("note-5"));
  });

  it("markNoteDeleted is idempotent on duplicate tombstone", async () => {
    await notesRepo.markNoteDeleted("ghost");
    await notesRepo.markNoteDeleted("ghost"); // must not throw
    const tombstones = await notesRepo.listDeletedNoteIds();
    assert.equal(tombstones.filter((x) => x === "ghost").length, 1);
  });

  it("deleteAllNotes wipes notes + tombstones atomically", async () => {
    await notesRepo.createNote({ id: "note-6", bookId: "local-b1", type: "note", content: "x" });
    await notesRepo.createNote({ id: "note-7", bookId: "local-b1", type: "note", content: "x" });
    await notesRepo.markNoteDeleted("old-ghost");
    await notesRepo.deleteAllNotes();
    assert.equal((await notesRepo.listNotes()).length, 0);
    assert.equal((await notesRepo.listDeletedNoteIds()).length, 0);
  });

  it("upsertNote creates, then updates on second call (idempotent)", async () => {
    await notesRepo.upsertNote({ id: "note-u1", bookId: "local-b1", type: "quote", content: "v1" });
    await notesRepo.upsertNote({
      id: "note-u1",
      bookId: "local-b1",
      type: "quote",
      content: "v2",
    });
    const got = await notesRepo.getNote("note-u1");
    assert.equal(got?.content, "v2");
    const all = await notesRepo.listNotesForBook("local-b1");
    assert.equal(all.filter((n) => n.id === "note-u1").length, 1);
  });

  it("upsertNote preserves original createdAt on update", async () => {
    await notesRepo.upsertNote({
      id: "note-u2",
      bookId: "local-b1",
      type: "quote",
      content: "first",
      createdAt: "2025-01-01",
    });
    await notesRepo.upsertNote({
      id: "note-u2",
      bookId: "local-b1",
      type: "quote",
      content: "second",
      createdAt: "2025-06-01",
    });
    const got = await notesRepo.getNote("note-u2");
    assert.equal(got?.createdAt, "2025-01-01");
    assert.equal(got?.content, "second");
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

  it("deleteAllSessions wipes the table", async () => {
    await sessionsRepo.createSession({
      id: "rs-6",
      bookId: "local-b2",
      date: "2026-01-01",
      minutes: 5,
      pagesRead: 0,
      startPage: 0,
      endPage: 0,
    });
    const wiped = await sessionsRepo.deleteAllSessions();
    assert.equal(wiped, 1);
    assert.equal((await sessionsRepo.listSessions()).length, 0);
  });

  it("upsertSession is idempotent on repeat", async () => {
    await sessionsRepo.upsertSession({
      id: "rs-u1",
      bookId: "local-b2",
      date: "2026-01-01",
      minutes: 10,
      pagesRead: 0,
      startPage: 0,
      endPage: 0,
    });
    await sessionsRepo.upsertSession({
      id: "rs-u1",
      bookId: "local-b2",
      date: "2026-01-01",
      minutes: 25,
      pagesRead: 0,
      startPage: 0,
      endPage: 0,
    });
    const all = await sessionsRepo.listSessionsForBook("local-b2");
    assert.equal(all.filter((s) => s.id === "rs-u1").length, 1);
    assert.equal(all.find((s) => s.id === "rs-u1")?.minutes, 25);
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

describe("chats repo", () => {
  it("createChat + listChats round-trip", async () => {
    const c = await chatsRepo.createChat({ id: "c1" });
    assert.equal(c.id, "c1");
    assert.equal(c.title, null);
    const all = await chatsRepo.listChats();
    assert.equal(all.length, 1);
    assert.equal(all[0].id, "c1");
    assert.equal(all[0].title, null);
  });

  it("appendMessage + getChat returns messages in createdAt order", async () => {
    await chatsRepo.createChat({ id: "c1" });
    await chatsRepo.appendMessage({ id: "m1", chatId: "c1", role: "user", content: "hi" });
    await chatsRepo.appendMessage({
      id: "m2",
      chatId: "c1",
      role: "assistant",
      content: "hello",
    });
    const chat = await chatsRepo.getChat("c1");
    assert.ok(chat);
    assert.equal(chat.messages.length, 2);
    assert.equal(chat.messages[0].id, "m1");
    assert.equal(chat.messages[0].role, "user");
    assert.equal(chat.messages[1].id, "m2");
    assert.equal(chat.messages[1].role, "assistant");
    assert.equal(chat.messages[1].content, "hello");
  });

  it("deleteChat cascades — chat + messages both gone", async () => {
    await chatsRepo.createChat({ id: "c1" });
    await chatsRepo.appendMessage({ id: "m1", chatId: "c1", role: "user", content: "x" });
    await chatsRepo.deleteChat("c1");
    assert.equal(await chatsRepo.getChat("c1"), null);
    // FK cascade should have removed the message row too.
    const remaining = dbClient
      .getRawSqlite()
      .prepare("SELECT id FROM chat_messages WHERE chat_id = ?")
      .all("c1");
    assert.deepEqual(remaining, []);
  });

  it("renameChat updates title and bumps updatedAt", async () => {
    await chatsRepo.createChat({ id: "c1" });
    const before = (await chatsRepo.getChat("c1"))!.session.updatedAt;
    await new Promise((r) => setTimeout(r, 5));
    const renamed = await chatsRepo.renameChat("c1", "Nowy tytuł");
    assert.equal(renamed.title, "Nowy tytuł");
    assert.notEqual(renamed.updatedAt, before);
    const got = await chatsRepo.getChat("c1");
    assert.equal(got?.session.title, "Nowy tytuł");
  });

  it("touchChat bumps updatedAt without changing title", async () => {
    await chatsRepo.createChat({ id: "c1" });
    await chatsRepo.renameChat("c1", "Pierwszy tytuł");
    const before = (await chatsRepo.getChat("c1"))!.session.updatedAt;
    await new Promise((r) => setTimeout(r, 5));
    await chatsRepo.touchChat("c1");
    const after = (await chatsRepo.getChat("c1"))!.session.updatedAt;
    assert.notEqual(after, before);
    assert.equal((await chatsRepo.getChat("c1"))!.session.title, "Pierwszy tytuł");
  });

  it("appendMessage bumps parent session.updatedAt (so listChats re-orders)", async () => {
    await chatsRepo.createChat({ id: "c1" });
    await chatsRepo.createChat({ id: "c2" });
    // Sleep so c2's updatedAt is strictly later than c1's (insertion-order tiebreak).
    await new Promise((r) => setTimeout(r, 5));
    // Appending a message to c1 should lift it to the top of the list.
    await chatsRepo.appendMessage({ id: "m1", chatId: "c1", role: "user", content: "hello" });
    const all = await chatsRepo.listChats();
    assert.equal(all.length, 2);
    assert.equal(all[0].id, "c1");
    assert.equal(all[1].id, "c2");
  });
});

describe("handwriting_pages repo", () => {
  beforeEach(async () => {
    // We need a parent note (FK on handwriting_pages.note_id → notes.id).
    await books.upsertBook({ id: "local-b1", title: "B", author: "X" });
    await notesRepo.createNote({
      id: "note-1",
      bookId: "local-b1",
      type: "note",
      title: "Pismo",
    });
  });

  it("listPages returns empty array when note has no pages", async () => {
    const pages = await handwritingRepo.listPages("note-1");
    assert.deepEqual(pages, []);
  });

  it("appendPage adds pages 0, 1, 2 in order with the right index", async () => {
    const p0 = await handwritingRepo.appendPage("note-1");
    const p1 = await handwritingRepo.appendPage("note-1");
    const p2 = await handwritingRepo.appendPage("note-1");
    assert.equal(p0.pageIndex, 0);
    assert.equal(p1.pageIndex, 1);
    assert.equal(p2.pageIndex, 2);
    const pages = await handwritingRepo.listPages("note-1");
    assert.deepEqual(
      pages.map((p) => p.pageIndex),
      [0, 1, 2],
    );
  });

  it("savePage upserts: new id creates row, same id updates dataUrl", async () => {
    await handwritingRepo.savePage({
      id: "hwp-a",
      noteId: "note-1",
      pageIndex: 0,
      dataUrl: "data:image/png;base64,AAA",
    });
    const before = (await handwritingRepo.getPage("hwp-a"))!;
    assert.equal(before.dataUrl, "data:image/png;base64,AAA");

    await new Promise((r) => setTimeout(r, 5));
    await handwritingRepo.savePage({
      id: "hwp-a",
      noteId: "note-1",
      pageIndex: 0,
      dataUrl: "data:image/png;base64,BBB",
    });
    const after = (await handwritingRepo.getPage("hwp-a"))!;
    assert.equal(after.dataUrl, "data:image/png;base64,BBB");
    assert.equal(after.createdAt, before.createdAt, "createdAt preserved on update");
    assert.notEqual(after.updatedAt, before.updatedAt, "updatedAt bumped");
  });

  it("deletePage removes the row; renumberPages compacts 0..N-1", async () => {
    const p0 = await handwritingRepo.appendPage("note-1");
    const p1 = await handwritingRepo.appendPage("note-1");
    const p2 = await handwritingRepo.appendPage("note-1");
    assert.ok(await handwritingRepo.deletePage(p1.id));
    // Renumber so p0 stays 0 and p2 becomes 1.
    await handwritingRepo.renumberPages("note-1");
    const remaining = await handwritingRepo.listPages("note-1");
    assert.equal(remaining.length, 2);
    assert.equal(remaining[0].id, p0.id);
    assert.equal(remaining[0].pageIndex, 0);
    assert.equal(remaining[1].id, p2.id);
    assert.equal(remaining[1].pageIndex, 1, "p2 renumbered into the gap");
  });

  it("ON DELETE CASCADE: deleting the parent note wipes its pages", async () => {
    await handwritingRepo.appendPage("note-1");
    await handwritingRepo.appendPage("note-1");
    assert.equal(await handwritingRepo.countPages("note-1"), 2);
    await notesRepo.deleteNote("note-1");
    assert.equal(await handwritingRepo.countPages("note-1"), 0);
  });

  it("maxPageIndex returns -1 for a note with no pages", async () => {
    assert.equal(await handwritingRepo.maxPageIndex("note-1"), -1);
  });
});
