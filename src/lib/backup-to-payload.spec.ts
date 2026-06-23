// Agata — sanity check that a localStorage `buildBackup()` round-trips through
// the server-side `BackupPayloadSchema`. Catches drift early: if anyone changes
// the localStorage shape (e.g. renames a key), the schema will reject it and
// the import UI will show a clear error instead of silently dropping rows.
import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";

import { buildBackup, HANDWRITING_PREFS_KEY } from "./backup";
import { BOOKS_KEY } from "./books-store";
import { BOOK_STATE_KEY, READING_SESSIONS_KEY } from "./book-workspace-store";
import { NOTES_STORAGE_KEY, NOTES_DELETED_KEY } from "./notes-store";
import { GOALS_KEY } from "./goals-store";
import { BackupPayloadSchema, previewBackup } from "@/lib/api/import-schema";

// jsdom-free shim: buildBackup() guards on `typeof window !== "undefined"`,
// so we set one up just for the duration of the test.
function setWindow() {
  (globalThis as unknown as { window: { localStorage: Storage } }).window = {
    localStorage: makeLocalStorage(),
  };
}

function makeLocalStorage(): Storage {
  const store = new Map<string, string>();
  return {
    get length() {
      return store.size;
    },
    clear: () => store.clear(),
    getItem: (k) => (store.has(k) ? store.get(k)! : null),
    key: (i) => Array.from(store.keys())[i] ?? null,
    removeItem: (k) => {
      store.delete(k);
    },
    setItem: (k, v) => {
      store.set(k, String(v));
    },
  };
}

describe("buildBackup -> BackupPayloadSchema", () => {
  beforeEach(() => {
    setWindow();
  });

  it("returns an empty-but-valid payload when localStorage is empty", () => {
    const built = buildBackup();
    const parsed = BackupPayloadSchema.safeParse(built);
    assert.equal(parsed.success, true, "buildBackup() should pass the server schema");
  });

  it("preserves localBooks + overrides + deletedIds through the schema", () => {
    const ls = (globalThis.window as unknown as { localStorage: Storage }).localStorage;
    ls.setItem(
      BOOKS_KEY,
      JSON.stringify({
        localBooks: [{ id: "b1", title: "Lalka" }],
        overrides: { b1: { currentPage: 50 } },
        deletedIds: ["x"],
      }),
    );
    const built = buildBackup();
    const parsed = BackupPayloadSchema.safeParse(built);
    assert.equal(parsed.success, true);
    if (!parsed.success) return;
    const preview = previewBackup(parsed.data);
    assert.equal(preview.books, 1);
    assert.equal(preview.ok, true);
  });

  it("captures notes, sessions, bookState, goals and handwritingPrefs", () => {
    const ls = (globalThis.window as unknown as { localStorage: Storage }).localStorage;
    ls.setItem(
      NOTES_STORAGE_KEY,
      JSON.stringify([{ id: "n1", bookId: "b1", type: "quote", content: "x" }]),
    );
    ls.setItem(
      READING_SESSIONS_KEY,
      JSON.stringify([
        {
          id: "s1",
          bookId: "b1",
          date: "2026-06-21",
          minutes: 10,
          pagesRead: 0,
          startPage: 0,
          endPage: 0,
        },
      ]),
    );
    ls.setItem(BOOK_STATE_KEY, JSON.stringify({ b1: { status: "reading", currentPage: 42 } }));
    ls.setItem(GOALS_KEY, JSON.stringify({ yearlyBooks: 24, weeklyMinutes: 210 }));
    ls.setItem(HANDWRITING_PREFS_KEY, JSON.stringify({ colour: "navy" }));

    const built = buildBackup();
    const parsed = BackupPayloadSchema.safeParse(built);
    assert.equal(parsed.success, true);
    if (!parsed.success) return;
    const preview = previewBackup(parsed.data);
    assert.equal(preview.notes, 1);
    assert.equal(preview.sessions, 1);
    assert.equal(preview.goals, 1);
    assert.equal(preview.handwritingPrefs, true);
  });

  it("collects agata-note-draft-* keys into noteDrafts", () => {
    const ls = (globalThis.window as unknown as { localStorage: Storage }).localStorage;
    ls.setItem("agata-note-draft-a", JSON.stringify({ content: "draft A" }));
    ls.setItem("agata-note-draft-b", JSON.stringify({ content: "draft B" }));
    // ad-hoc key (no draft prefix) should NOT end up in noteDrafts.
    ls.setItem("agata-rogue", JSON.stringify({ x: 1 }));

    const built = buildBackup();
    const parsed = BackupPayloadSchema.safeParse(built);
    assert.equal(parsed.success, true);
    if (!parsed.success) return;
    const preview = previewBackup(parsed.data);
    assert.equal(preview.drafts, 2);
  });
});
