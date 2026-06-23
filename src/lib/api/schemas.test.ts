// Agata — schema validation tests. Server functions are thin wrappers; the
// schemas ARE the contract. TDD coverage for every Zod schema the RPC layer uses.
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  BookInputSchema,
  BookPatchSchema,
  NoteInputSchema,
  NotePatchSchema,
  SessionInputSchema,
  SessionPatchSchema,
  GoalsInputSchema,
  SettingKeySchema,
  SettingPutSchema,
} from "@/lib/api/schemas";

describe("BookInputSchema", () => {
  it("accepts a minimal valid book", () => {
    const r = BookInputSchema.safeParse({ id: "b1", title: "Solaris" });
    assert.equal(r.success, true);
    if (r.success) {
      assert.equal(r.data.author, "");
      assert.equal(r.data.isbn, "");
      assert.equal(r.data.description, "");
    }
  });

  it("rejects an empty title", () => {
    const r = BookInputSchema.safeParse({ id: "b1", title: "" });
    assert.equal(r.success, false);
  });

  it("rejects missing id", () => {
    const r = BookInputSchema.safeParse({ title: "X" });
    assert.equal(r.success, false);
  });

  it("rejects negative pageCount", () => {
    const r = BookInputSchema.safeParse({ id: "b1", title: "X", pageCount: -1 });
    assert.equal(r.success, false);
  });

  it("rejects unknown status", () => {
    const r = BookInputSchema.safeParse({ id: "b1", title: "X", status: "abandoned" });
    assert.equal(r.success, false);
  });

  it("accepts all five statuses", () => {
    for (const s of ["reading", "queue", "finished", "paused", "dropped"]) {
      assert.equal(BookInputSchema.safeParse({ id: "b1", title: "X", status: s }).success, true);
    }
  });
});

describe("BookPatchSchema", () => {
  it("requires id even with empty patch", () => {
    assert.equal(BookPatchSchema.safeParse({}).success, false);
    assert.equal(BookPatchSchema.safeParse({ id: "b1" }).success, true);
  });

  it("accepts partial update with just title", () => {
    const r = BookPatchSchema.safeParse({ id: "b1", title: "New" });
    assert.equal(r.success, true);
  });
});

describe("NoteInputSchema", () => {
  const valid = { id: "n1", bookId: "b1", type: "quote" as const };

  it("accepts minimal note", () => {
    assert.equal(NoteInputSchema.safeParse(valid).success, true);
  });

  it("rejects missing bookId", () => {
    assert.equal(NoteInputSchema.safeParse({ id: "n1", type: "quote" }).success, false);
  });

  it("rejects unknown note type", () => {
    assert.equal(NoteInputSchema.safeParse({ ...valid, type: "sticker" }).success, false);
  });

  it("accepts all five note types", () => {
    for (const t of ["quote", "note", "page-photo", "chapter", "other"]) {
      assert.equal(NoteInputSchema.safeParse({ ...valid, type: t }).success, true);
    }
  });

  it("accepts nullable inputMode and drawingBackground", () => {
    const r = NoteInputSchema.safeParse({
      ...valid,
      inputMode: "handwriting",
      drawingBackground: "lined",
    });
    assert.equal(r.success, true);
  });
});

describe("NotePatchSchema", () => {
  it("requires id", () => {
    assert.equal(NotePatchSchema.safeParse({ content: "x" }).success, false);
    assert.equal(NotePatchSchema.safeParse({ id: "n1", content: "x" }).success, true);
  });
});

describe("SessionInputSchema", () => {
  it("accepts a valid session", () => {
    const r = SessionInputSchema.safeParse({
      id: "s1",
      bookId: "b1",
      date: "2026-06-21",
      minutes: 30,
      pagesRead: 12,
      startPage: 10,
      endPage: 22,
    });
    assert.equal(r.success, true);
  });

  it("rejects malformed date", () => {
    assert.equal(
      SessionInputSchema.safeParse({
        id: "s1",
        bookId: "b1",
        date: "21-06-2026",
        minutes: 0,
        pagesRead: 0,
        startPage: 0,
        endPage: 0,
      }).success,
      false,
    );
  });

  it("rejects negative minutes", () => {
    assert.equal(
      SessionInputSchema.safeParse({
        id: "s1",
        bookId: "b1",
        date: "2026-06-21",
        minutes: -1,
        pagesRead: 0,
        startPage: 0,
        endPage: 0,
      }).success,
      false,
    );
  });
});

describe("SessionPatchSchema", () => {
  it("requires id, allows partial", () => {
    assert.equal(SessionPatchSchema.safeParse({ minutes: 5 }).success, false);
    assert.equal(SessionPatchSchema.safeParse({ id: "s1", minutes: 5 }).success, true);
  });
});

describe("GoalsInputSchema", () => {
  it("accepts empty patch (no-op)", () => {
    assert.equal(GoalsInputSchema.safeParse({}).success, true);
  });

  it("accepts valid numbers", () => {
    assert.equal(GoalsInputSchema.safeParse({ yearlyBooks: 24, weeklyMinutes: 240 }).success, true);
  });

  it("rejects negative yearlyBooks", () => {
    assert.equal(GoalsInputSchema.safeParse({ yearlyBooks: -1 }).success, false);
  });
});

describe("SettingKeySchema / SettingPutSchema", () => {
  it("SettingKeySchema requires non-empty key", () => {
    assert.equal(SettingKeySchema.safeParse({ key: "" }).success, false);
    assert.equal(SettingKeySchema.safeParse({ key: "gigi.token" }).success, true);
  });

  it("SettingPutSchema accepts any JSON-shaped value", () => {
    for (const v of ["str", 42, true, null, { a: 1 }, [1, 2, 3]]) {
      assert.equal(SettingPutSchema.safeParse({ key: "k", value: v }).success, true);
    }
  });
});
