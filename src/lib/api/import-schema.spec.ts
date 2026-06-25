// Agata — tests for the backup-import schemas (parser + normaliser + preview).
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  BackupPayloadSchema,
  previewBackup,
  normaliseBackup,
  type BackupPayload,
} from "@/lib/api/import-schema";

// Helpers — keep test JSON minimal but realistic.
function makeBackup(overrides: Partial<BackupPayload["data"]> = {}): BackupPayload {
  return {
    app: "agata",
    schemaVersion: 1,
    exportedAt: "2026-06-21T12:00:00Z",
    data: {
      books: { localBooks: [], overrides: {}, deletedIds: [] },
      bookState: {},
      readingSessions: [],
      notes: [],
      notesDeleted: [],
      ...overrides,
    },
  };
}

describe("BackupPayloadSchema", () => {
  it("accepts a minimal agata backup", () => {
    const r = BackupPayloadSchema.safeParse(makeBackup());
    assert.equal(r.success, true);
  });

  it("rejects payloads with the wrong app tag", () => {
    const r = BackupPayloadSchema.safeParse({ ...makeBackup(), app: "not-agata" });
    assert.equal(r.success, false);
  });

  it("rejects payloads without a data field", () => {
    const r = BackupPayloadSchema.safeParse({ app: "agata", schemaVersion: 1 });
    assert.equal(r.success, false);
  });

  it("accepts extra keys inside `data` (forward-compat)", () => {
    const r = BackupPayloadSchema.safeParse(
      makeBackup({
        futureField: { something: "new" },
      } as unknown as Partial<BackupPayload["data"]>),
    );
    assert.equal(r.success, true);
  });

  it("rejects negative schemaVersion", () => {
    const r = BackupPayloadSchema.safeParse({ app: "agata", schemaVersion: -1, data: {} });
    assert.equal(r.success, false);
  });
});

describe("previewBackup", () => {
  it("returns zeros for an empty backup", () => {
    const p = previewBackup(makeBackup());
    assert.deepEqual(p, {
      books: 0,
      notes: 0,
      sessions: 0,
      goals: 0,
      drafts: 0,
      handwritingPrefs: false,
      ok: true,
    });
  });

  it("counts localBooks + overrides as separate books", () => {
    const p = previewBackup(
      makeBackup({
        books: {
          localBooks: [{ id: "a" }, { id: "b" }],
          overrides: { c: {}, d: {}, e: {} },
        },
      }),
    );
    assert.equal(p.books, 5);
  });

  it("counts notes and sessions", () => {
    const p = previewBackup(
      makeBackup({
        notes: [{ id: "n1" }, { id: "n2" }, { id: "n3" }],
        readingSessions: [{ id: "s1" }],
      }),
    );
    assert.equal(p.notes, 3);
    assert.equal(p.sessions, 1);
  });

  it("marks handwritingPrefs as present when truthy", () => {
    assert.equal(previewBackup(makeBackup({ handwritingPrefs: { x: 1 } })).handwritingPrefs, true);
    assert.equal(previewBackup(makeBackup()).handwritingPrefs, false);
  });

  it("counts noteDrafts as map size", () => {
    const p = previewBackup(
      makeBackup({ noteDrafts: { "agata-note-draft-a": {}, "agata-note-draft-b": {} } }),
    );
    assert.equal(p.drafts, 2);
  });

  it("treats empty goals object as no-goals (0)", () => {
    assert.equal(previewBackup(makeBackup({ goals: {} })).goals, 0);
    assert.equal(previewBackup(makeBackup({ goals: { yearlyBooks: 12 } })).goals, 1);
  });

  it("dedupes book ids that appear in both localBooks and overrides", () => {
    const p = previewBackup(
      makeBackup({
        books: {
          localBooks: [{ id: "a" }, { id: "b" }],
          overrides: { a: {}, c: {} },
        },
      }),
    );
    assert.equal(p.books, 3, "a, b, c — a is shared so counted once");
  });

  it("handles missing fields defensively", () => {
    const partial: BackupPayload = {
      app: "agata",
      schemaVersion: 1,
      data: {} as BackupPayload["data"],
    };
    const p = previewBackup(partial);
    assert.equal(p.books, 0);
    assert.equal(p.notes, 0);
    assert.equal(p.sessions, 0);
  });
});

describe("normaliseBackup", () => {
  it("returns empty arrays for an empty backup", () => {
    const n = normaliseBackup(makeBackup());
    assert.deepEqual(n.books.upserts, []);
    assert.deepEqual(n.books.deletedIds, []);
    assert.deepEqual(n.notes, []);
    assert.deepEqual(n.sessions, []);
    assert.deepEqual(n.deletedNoteIds, []);
    assert.equal(n.goals, undefined);
  });

  it("merges localBook + override + bookState into one row per id", () => {
    const n = normaliseBackup(
      makeBackup({
        books: {
          localBooks: [{ id: "b1", title: "Lalka", author: "Prus", status: "queue" }],
          overrides: { b1: { currentPage: 50 }, b2: { id: "b2", title: "Inny", author: "X" } },
        },
        bookState: {
          b1: { status: "reading", rating: 9, favourite: true },
        },
      }),
    );
    assert.equal(n.books.upserts.length, 2);
    const b1 = n.books.upserts.find((b) => b.id === "b1")!;
    assert.equal(b1.title, "Lalka");
    // bookState overlay wins over the localBook status + applies rating/favourite.
    assert.equal(b1.status, "reading");
    assert.equal(b1.rating, 9);
    assert.equal(b1.isFavourite, true);
    // override currentPage applies.
    assert.equal(b1.currentPage, 50);
  });

  it("drops invalid rows silently (Zod-validated per record)", () => {
    const n = normaliseBackup(
      makeBackup({
        books: {
          localBooks: [
            { id: "good", title: "OK" },
            // missing title + missing id -> both should fail
            { author: "x" },
            { id: "no-title" },
          ],
        },
      }),
    );
    assert.equal(n.books.upserts.length, 1);
    assert.equal(n.books.upserts[0].id, "good");
  });

  it("narrowes notes by NoteInputSchema", () => {
    const n = normaliseBackup(
      makeBackup({
        notes: [
          { id: "n1", bookId: "b1", type: "quote" },
          { id: "n2", bookId: "b1", type: "bogus" }, // invalid type
          { id: "n3" }, // missing bookId + type
          { id: "n4", bookId: "b1", type: "note", isFavourite: true },
        ],
      }),
    );
    assert.equal(n.notes.length, 2);
    assert.deepEqual(
      n.notes.map((x) => x.id),
      ["n1", "n4"],
    );
    assert.equal(n.notes[1].isFavourite, true);
  });

  it("narrowes sessions by SessionInputSchema (rejects bad dates)", () => {
    const n = normaliseBackup(
      makeBackup({
        readingSessions: [
          {
            id: "s1",
            bookId: "b1",
            date: "2026-06-21",
            minutes: 30,
            pagesRead: 0,
            startPage: 0,
            endPage: 0,
          },
          {
            id: "s2",
            bookId: "b1",
            date: "21-06-2026",
            minutes: 0,
            pagesRead: 0,
            startPage: 0,
            endPage: 0,
          },
        ],
      }),
    );
    assert.equal(n.sessions.length, 1);
    assert.equal(n.sessions[0].id, "s1");
  });

  it("extracts deletedNoteIds as a string array", () => {
    const n = normaliseBackup(
      makeBackup({ notesDeleted: ["a", "b", 42, null, "c"] as unknown as string[] }),
    );
    assert.deepEqual(n.deletedNoteIds, ["a", "b", "c"]);
  });

  it("extracts deletedIds from books shape", () => {
    const n = normaliseBackup(
      makeBackup({
        books: { localBooks: [], overrides: {}, deletedIds: ["del-1", "del-2"] },
      }),
    );
    assert.deepEqual(n.books.deletedIds, ["del-1", "del-2"]);
  });

  it("narrows goals", () => {
    const n = normaliseBackup(makeBackup({ goals: { yearlyBooks: 12, weeklyMinutes: 240 } }));
    assert.deepEqual(n.goals, { yearlyBooks: 12, weeklyMinutes: 240 });
  });

  it("aliases cover_url (snake) to coverUrl (camel)", () => {
    const n = normaliseBackup(
      makeBackup({
        books: {
          localBooks: [{ id: "b1", title: "X", cover_url: "https://example.com/c.jpg" }],
          overrides: {},
          deletedIds: [],
        },
      }),
    );
    const b1 = n.books.upserts.find((b) => b.id === "b1");
    assert.equal(b1?.coverUrl, "https://example.com/c.jpg");
  });

  it("dedupes books to one row per id even when present in both lists", () => {
    const n = normaliseBackup(
      makeBackup({
        books: {
          localBooks: [
            { id: "a", title: "A" },
            { id: "b", title: "B" },
          ],
          overrides: { a: { title: "A-updated" }, c: { id: "c", title: "C" } },
          deletedIds: [],
        },
      }),
    );
    assert.equal(n.books.upserts.length, 3);
    const a = n.books.upserts.find((b) => b.id === "a");
    assert.equal(a?.title, "A-updated");
  });
});

// --- H3: bounded unknown fields ---
//
// Every `z.unknown()` in BackupPayloadSchema used to be a DoS surface — a
// hostile backup could stuff a 1 GB payload under `handwritingPrefs` and
// the server would try to JSON.parse / serialise it. The fix caps the
// JSON-serialized size of each unknown value at 1024 bytes.

describe("BackupPayloadSchema bounds (H3)", () => {
  it("rejects a localBooks entry whose JSON-serialized size exceeds 1 KB", () => {
    const huge = { id: "b1", title: "X", garbage: "x".repeat(2000) };
    const r = BackupPayloadSchema.safeParse(makeBackup({ books: { localBooks: [huge] } }));
    assert.equal(r.success, false);
  });

  it("rejects a bookState entry whose JSON-serialized size exceeds 1 KB", () => {
    const huge = { status: "read", garbage: "x".repeat(2000) };
    const r = BackupPayloadSchema.safeParse(makeBackup({ bookState: { b1: huge } }));
    assert.equal(r.success, false);
  });

  it("rejects an overrides entry whose JSON-serialized size exceeds 1 KB", () => {
    const huge = { title: "X", garbage: "x".repeat(2000) };
    const r = BackupPayloadSchema.safeParse(makeBackup({ books: { overrides: { b1: huge } } }));
    assert.equal(r.success, false);
  });

  it("rejects a handwritingPrefs whose JSON-serialized size exceeds 1 KB", () => {
    const huge = { stroke: "x".repeat(2000) };
    const r = BackupPayloadSchema.safeParse(makeBackup({ handwritingPrefs: huge }));
    assert.equal(r.success, false);
  });

  it("rejects an extraKeys entry whose JSON-serialized size exceeds 1 KB", () => {
    const huge = "x".repeat(2000);
    const r = BackupPayloadSchema.safeParse(makeBackup({ extraKeys: { k: huge } }));
    assert.equal(r.success, false);
  });

  it("accepts unknown values up to 1 KB", () => {
    const small = { stroke: "x".repeat(1000) };
    const r = BackupPayloadSchema.safeParse(makeBackup({ handwritingPrefs: small }));
    assert.equal(r.success, true);
  });

  it("rejects a note draft entry whose JSON-serialized size exceeds 1 KB", () => {
    const huge = "x".repeat(2000);
    const r = BackupPayloadSchema.safeParse(makeBackup({ noteDrafts: { d1: huge } }));
    assert.equal(r.success, false);
  });
});
