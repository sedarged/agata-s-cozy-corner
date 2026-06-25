// M5: client-side BackupPayload validation in MigrateToServerCard.
//
// `buildBackup()` reads from localStorage and the IndexedDB of hand-drawn
// notes. A malformed payload (e.g. corrupted storage, schema drift between
// versions) used to flow straight into `mutateAsync`, hitting the server
// only to bounce back as a 400 Zod error. Worse: an entirely empty payload
// would still POST and silently no-op. Pin the contract with these tests.
import { test } from "node:test";
import assert from "node:assert/strict";
import { validateBackupPayloadForImport } from "./import-schema";

// Helper that builds the minimal valid payload shape (mirrors buildBackup()).
function minimalValid() {
  return {
    app: "agata" as const,
    schemaVersion: 1,
    exportedAt: "2026-06-25T12:00:00Z",
    data: {
      books: { localBooks: [], overrides: {}, deletedIds: [] },
      notes: [],
      readingSessions: [],
    },
  };
}

test("accepts a minimal valid empty backup (matches buildBackup's empty-store shape)", () => {
  const v = validateBackupPayloadForImport(minimalValid());
  assert.equal(v.ok, true);
});

test("accepts a fully-populated backup", () => {
  const v = validateBackupPayloadForImport({
    ...minimalValid(),
    data: {
      books: {
        localBooks: [
          { id: "b1", title: "Foo", author: "Bar", status: "reading", tags: ["fiction"] },
        ],
        overrides: {},
        deletedIds: [],
      },
      notes: [{ id: "n1", bookId: "b1", type: "quote", content: "quote" }],
      readingSessions: [
        {
          id: "s1",
          bookId: "b1",
          date: "2026-06-25",
          minutes: 30,
          pagesRead: 10,
          startPage: 0,
          endPage: 10,
        },
      ],
      goals: { yearlyBooks: 12, weeklyMinutes: 240 },
      noteDrafts: {},
      handwritingPrefs: { tool: "pen", color: "#000" },
    },
  });
  assert.equal(v.ok, true);
});

test("rejects when app is wrong literal", () => {
  const v = validateBackupPayloadForImport({ ...minimalValid(), app: "evil" });
  assert.equal(v.ok, false);
});

test("rejects when schemaVersion is missing", () => {
  const { schemaVersion: _sv, ...rest } = minimalValid();
  void _sv;
  const v = validateBackupPayloadForImport(rest);
  assert.equal(v.ok, false);
});

test("rejects null payload (the bug M5 closes — empty POST)", () => {
  const v = validateBackupPayloadForImport(null);
  assert.equal(v.ok, false);
});

test("rejects completely empty object (the bug M5 closes)", () => {
  const v = validateBackupPayloadForImport({});
  assert.equal(v.ok, false);
});

test("rejects when data.books is not an object", () => {
  const v = validateBackupPayloadForImport({
    ...minimalValid(),
    data: { ...minimalValid().data, books: "nope" },
  });
  assert.equal(v.ok, false);
});
