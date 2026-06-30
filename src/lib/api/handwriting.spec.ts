// TDD tests for the multi-page handwriting route handlers.
//
// The handlers are pure — they accept an optional `notesRepo` and
// `handwritingRepo` so tests can inject in-memory fakes. The real
// repositories are only used by the createFileRoute wiring.
//
// Coverage pins:
//   - 400 on a noteId that fails the id allowlist (length / charset).
//   - 404 when the parent note doesn't exist (no orphan pages).
//   - 200 + DTO[] on GET; round-trip preserves the JSON strokes blob
//     (no re-encoding surprises — dataUrl <-> strokes bridge is correct).
//   - PUT validates the body via Zod, rejects noteId mismatch (caller
//     can't write a page to a different note than the URL claims), and
//     returns the stored DTO shape (so the React Query cache updates).
//   - DELETE only removes pages that belong to the URL's note (cross-note
//     404), and re-packs the remaining indexes.
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  handleGetPages,
  handlePutPage,
  handleDeletePage,
  rowToDTO,
  strokesToDataUrl,
  dataUrlToStrokes,
  type HandwritingPageDTO,
} from "./handwriting";
import type { HandwritingPage } from "@/lib/db/repositories/handwriting";

const NOTE_ID = "note-abc";
const PAGE_ID = "hwp-1-aaaaaa";

function makeNote(id: string) {
  return {
    id,
    bookId: "book-1",
    type: "note" as const,
    title: null,
    content: "",
    quoteText: null,
    comment: null,
    pageNumber: null,
    chapterNumber: null,
    chapterTitle: null,
    photoUrl: null,
    inputMode: "handwriting" as const,
    drawingDataUrl: null,
    drawingBackground: "plain" as const,
    isFavourite: false,
    tags: [],
    createdAt: "2026-06-30T00:00:00.000Z",
    updatedAt: "2026-06-30T00:00:00.000Z",
  };
}

function makeRow(p: Partial<HandwritingPage> = {}): HandwritingPage {
  return {
    id: PAGE_ID,
    noteId: NOTE_ID,
    pageIndex: 0,
    dataUrl: "",
    background: "plain",
    createdAt: "2026-06-30T00:00:00.000Z",
    updatedAt: "2026-06-30T00:00:00.000Z",
    ...p,
  };
}

function makeNotesRepo(opts: { note?: ReturnType<typeof makeNote> | null } = {}) {
  return {
    getNote: async (id: string) => {
      if (opts.note === null) return undefined;
      const n = opts.note ?? makeNote(id);
      return n.id === id ? n : undefined;
    },
  };
}

function makeHandwritingRepo(
  opts: {
    listPages?: (noteId: string) => Promise<HandwritingPage[]>;
    getPage?: (id: string) => Promise<HandwritingPage | undefined>;
    savePage?: (
      input: Parameters<typeof import("@/lib/db/repositories/handwriting").savePage>[0],
    ) => Promise<HandwritingPage>;
    deletePage?: (id: string) => Promise<boolean>;
    renumberPages?: (noteId: string) => Promise<void>;
  } = {},
) {
  return {
    listPages: opts.listPages ?? (async () => []),
    getPage: opts.getPage ?? (async () => undefined),
    savePage:
      opts.savePage ??
      (async (input) =>
        makeRow({
          id: input.id,
          noteId: input.noteId,
          pageIndex: input.pageIndex,
          dataUrl: input.dataUrl,
          background: input.background,
        })),
    deletePage: opts.deletePage ?? (async () => true),
    renumberPages: opts.renumberPages ?? (async () => undefined),
  };
}

// ---------- GET ----------

test("handleGetPages returns 400 for a noteId that fails the allowlist", async () => {
  const res = await handleGetPages("..%2F..%2Fetc%2Fpasswd", {
    notesRepo: makeNotesRepo(),
    handwritingRepo: makeHandwritingRepo(),
  });
  assert.equal(res.status, 400);
  const body = (await res.json()) as { error?: string };
  assert.equal(body.error, "invalid-note-id");
});

test("handleGetPages returns 404 when the parent note is missing", async () => {
  const res = await handleGetPages("missing-note", {
    notesRepo: makeNotesRepo({ note: null }),
    handwritingRepo: makeHandwritingRepo(),
  });
  assert.equal(res.status, 404);
});

test("handleGetPages returns 200 with DTO[] in pageIndex order", async () => {
  const strokes = [
    {
      type: "stroke",
      points: [
        [0, 0],
        [1, 1],
      ],
    },
  ];
  const rows: HandwritingPage[] = [
    makeRow({ id: "p0", pageIndex: 0, dataUrl: strokesToDataUrl(strokes), background: "lined" }),
    makeRow({ id: "p1", pageIndex: 1, dataUrl: strokesToDataUrl([]) }),
  ];
  const res = await handleGetPages(NOTE_ID, {
    notesRepo: makeNotesRepo(),
    handwritingRepo: makeHandwritingRepo({ listPages: async () => rows }),
  });
  assert.equal(res.status, 200);
  const dtos = (await res.json()) as HandwritingPageDTO[];
  assert.equal(dtos.length, 2);
  assert.equal(dtos[0].id, "p0");
  assert.equal(dtos[0].background, "lined");
  assert.deepEqual(dtos[0].strokes, strokes);
  // X-Content-Type-Options is the L1 safety header.
  assert.equal(res.headers.get("X-Content-Type-Options"), "nosniff");
});

test("handleGetPages returns an empty array when the note has no pages", async () => {
  const res = await handleGetPages(NOTE_ID, {
    notesRepo: makeNotesRepo(),
    handwritingRepo: makeHandwritingRepo({ listPages: async () => [] }),
  });
  assert.equal(res.status, 200);
  const dtos = (await res.json()) as HandwritingPageDTO[];
  assert.deepEqual(dtos, []);
});

// ---------- PUT ----------

test("handlePutPage returns 400 for an invalid noteId in the URL", async () => {
  const res = await handlePutPage(
    "bad id with spaces",
    { id: "p1", noteId: "bad id with spaces", pageIndex: 0, strokes: [], background: "plain" },
    { notesRepo: makeNotesRepo(), handwritingRepo: makeHandwritingRepo() },
  );
  assert.equal(res.status, 400);
});

test("handlePutPage returns 404 when the parent note is missing", async () => {
  const res = await handlePutPage(
    "missing-note",
    { id: "p1", noteId: "missing-note", pageIndex: 0, strokes: [], background: "plain" },
    { notesRepo: makeNotesRepo({ note: null }), handwritingRepo: makeHandwritingRepo() },
  );
  assert.equal(res.status, 404);
});

test("handlePutPage returns 400 for an invalid body (missing id)", async () => {
  const res = await handlePutPage(
    NOTE_ID,
    { noteId: NOTE_ID, pageIndex: 0, strokes: [], background: "plain" } as never,
    { notesRepo: makeNotesRepo(), handwritingRepo: makeHandwritingRepo() },
  );
  assert.equal(res.status, 400);
  const body = (await res.json()) as { error?: string };
  assert.equal(body.error, "invalid-body");
});

test("handlePutPage returns 400 for a body whose noteId mismatches the URL", async () => {
  const res = await handlePutPage(
    NOTE_ID,
    { id: "p1", noteId: "different-note", pageIndex: 0, strokes: [], background: "plain" },
    { notesRepo: makeNotesRepo(), handwritingRepo: makeHandwritingRepo() },
  );
  assert.equal(res.status, 400);
  const body = (await res.json()) as { error?: string };
  assert.equal(body.error, "note-id-mismatch");
});

test("handlePutPage returns 400 for a background outside the enum", async () => {
  const res = await handlePutPage(
    NOTE_ID,
    { id: "p1", noteId: NOTE_ID, pageIndex: 0, strokes: [], background: "holographic" as never },
    { notesRepo: makeNotesRepo(), handwritingRepo: makeHandwritingRepo() },
  );
  assert.equal(res.status, 400);
});

test("handlePutPage returns 400 when strokes JSON exceeds the 2 MB cap", async () => {
  // 2 MB + 1 byte once JSON-serialised. The refine in the Zod schema runs the
  // cap so we reject before any DB write — pinned here because the cap is the
  // only defence against an attacker pushing a 100 MB blob into a row.
  const big = { x: "a".repeat(2_000_001) };
  const res = await handlePutPage(
    NOTE_ID,
    { id: "p1", noteId: NOTE_ID, pageIndex: 0, strokes: big, background: "plain" },
    { notesRepo: makeNotesRepo(), handwritingRepo: makeHandwritingRepo() },
  );
  assert.equal(res.status, 400);
});

test("handlePutPage returns 400 when strokes contain a circular reference", async () => {
  // JSON.stringify throws on cycles — the refine's try/catch converts that
  // into a clean 400 instead of a 500 from a TypeError bubbling up.
  const circ: Record<string, unknown> = {};
  circ.self = circ;
  const res = await handlePutPage(
    NOTE_ID,
    { id: "p1", noteId: NOTE_ID, pageIndex: 0, strokes: circ, background: "plain" },
    { notesRepo: makeNotesRepo(), handwritingRepo: makeHandwritingRepo() },
  );
  assert.equal(res.status, 400);
});

test("handlePutPage returns 400 when pageIndex exceeds the cap", async () => {
  const res = await handlePutPage(
    NOTE_ID,
    { id: "p1", noteId: NOTE_ID, pageIndex: 10_001, strokes: [], background: "plain" },
    { notesRepo: makeNotesRepo(), handwritingRepo: makeHandwritingRepo() },
  );
  assert.equal(res.status, 400);
});

test("handlePutPage returns 400 when the body id fails the allowlist", async () => {
  const res = await handlePutPage(
    NOTE_ID,
    {
      id: "p/../bad",
      noteId: NOTE_ID,
      pageIndex: 0,
      strokes: [],
      background: "plain",
    },
    { notesRepo: makeNotesRepo(), handwritingRepo: makeHandwritingRepo() },
  );
  assert.equal(res.status, 400);
});

test("handlePutPage round-trips strokes through dataUrl<->strokes bridge", async () => {
  const strokes = [
    {
      tool: "pen",
      color: "#000",
      points: [
        [0, 0],
        [10, 10],
        [20, 5],
      ],
    },
  ];
  type SavePageInput = Parameters<typeof import("@/lib/db/repositories/handwriting").savePage>[0];
  // Box pattern: a closure mutating a primitive `let` binding narrows the
  // outer type to `null` in TS, so `assert.ok(captured, ...)` would end up
  // narrowed to `never`. The box object's `.value` keeps the union alive
  // across the closure boundary.
  const captured: { value: SavePageInput | null } = { value: null };
  const res = await handlePutPage(
    NOTE_ID,
    { id: "p1", noteId: NOTE_ID, pageIndex: 2, strokes, background: "grid" },
    {
      notesRepo: makeNotesRepo(),
      handwritingRepo: makeHandwritingRepo({
        savePage: async (input) => {
          captured.value = input;
          return makeRow({ ...input });
        },
      }),
    },
  );
  assert.equal(res.status, 200);
  assert.ok(captured.value, "savePage was called");
  // The dataUrl the handler wrote is base64(JSON(strokes)) — not a PNG.
  assert.ok(captured.value.dataUrl.startsWith("data:application/json;base64,"));
  // And it decodes back to the original strokes.
  assert.deepEqual(dataUrlToStrokes(captured.value.dataUrl), strokes);
  const dto = (await res.json()) as HandwritingPageDTO;
  assert.equal(dto.id, "p1");
  assert.equal(dto.pageIndex, 2);
  assert.equal(dto.background, "grid");
  assert.deepEqual(dto.strokes, strokes);
});

// ---------- DELETE ----------

test("handleDeletePage returns 400 for an invalid noteId", async () => {
  const res = await handleDeletePage("..%2Fbad", "p1", {
    notesRepo: makeNotesRepo(),
    handwritingRepo: makeHandwritingRepo(),
  });
  assert.equal(res.status, 400);
});

test("handleDeletePage returns 400 for an invalid pageId", async () => {
  const res = await handleDeletePage(NOTE_ID, "p/../bad", {
    notesRepo: makeNotesRepo(),
    handwritingRepo: makeHandwritingRepo(),
  });
  assert.equal(res.status, 400);
});

test("handleDeletePage returns 404 when the parent note is missing", async () => {
  const res = await handleDeletePage("missing-note", "p1", {
    notesRepo: makeNotesRepo({ note: null }),
    handwritingRepo: makeHandwritingRepo(),
  });
  assert.equal(res.status, 404);
});

test("handleDeletePage returns 404 when the page exists but belongs to a different note", async () => {
  const res = await handleDeletePage(NOTE_ID, "p1", {
    notesRepo: makeNotesRepo(),
    handwritingRepo: makeHandwritingRepo({
      getPage: async () => makeRow({ id: "p1", noteId: "other-note" }),
    }),
  });
  assert.equal(res.status, 404);
});

test("handleDeletePage returns 404 when the page doesn't exist", async () => {
  const res = await handleDeletePage(NOTE_ID, "missing-page", {
    notesRepo: makeNotesRepo(),
    handwritingRepo: makeHandwritingRepo({ getPage: async () => undefined }),
  });
  assert.equal(res.status, 404);
});

test("handleDeletePage deletes + re-packs the remaining pages", async () => {
  const deleted: string[] = [];
  let renumberedNote: string | null = null;
  const res = await handleDeletePage(NOTE_ID, "p1", {
    notesRepo: makeNotesRepo(),
    handwritingRepo: makeHandwritingRepo({
      getPage: async (id) => (id === "p1" ? makeRow({ id: "p1", noteId: NOTE_ID }) : undefined),
      deletePage: async (id) => {
        deleted.push(id);
        return true;
      },
      renumberPages: async (noteId) => {
        renumberedNote = noteId;
      },
    }),
  });
  assert.equal(res.status, 200);
  assert.deepEqual(deleted, ["p1"]);
  assert.equal(renumberedNote, NOTE_ID);
  const body = (await res.json()) as { ok?: boolean };
  assert.equal(body.ok, true);
});

// ---------- dataUrl <-> strokes bridge ----------

test("strokesToDataUrl + dataUrlToStrokes round-trips an empty array", () => {
  assert.deepEqual(dataUrlToStrokes(strokesToDataUrl([])), []);
});

test("strokesToDataUrl + dataUrlToStrokes round-trips a complex value", () => {
  const strokes = [
    { tool: "pen", points: [[0, 0]] },
    {
      tool: "marker",
      points: [
        [1, 1],
        [2, 2],
      ],
    },
    { tool: "eraser", points: [] },
  ];
  assert.deepEqual(dataUrlToStrokes(strokesToDataUrl(strokes)), strokes);
});

test("dataUrlToStrokes returns [] for an empty string", () => {
  assert.deepEqual(dataUrlToStrokes(""), []);
});

test("dataUrlToStrokes returns [] for a non-data url", () => {
  assert.deepEqual(dataUrlToStrokes("not a data url"), []);
});

test("dataUrlToStrokes returns [] for a corrupted base64 payload", () => {
  assert.deepEqual(dataUrlToStrokes("data:application/json;base64,!!!not-base64!!!"), []);
});

test("dataUrlToStrokes returns [] for a legacy image/png data url (pre-multi-page import)", () => {
  // Real-world: a row imported from a pre-multi-page version where
  // `notes.drawingDataUrl` was migrated into the page table as a PNG blob.
  // JSON.parse chokes on the decoded binary; the catch returns [] so the
  // canvas paints an empty page rather than crashing.
  assert.deepEqual(dataUrlToStrokes("data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAA"), []);
});

// ---------- rowToDTO ----------

test("rowToDTO translates the stored dataUrl back to strokes", () => {
  const strokes = [{ tool: "pen", points: [[0, 0]] }];
  const dto = rowToDTO(makeRow({ dataUrl: strokesToDataUrl(strokes), background: "cream" }));
  assert.equal(dto.id, PAGE_ID);
  assert.equal(dto.background, "cream");
  assert.deepEqual(dto.strokes, strokes);
});

test("rowToDTO returns [] for a row whose dataUrl is empty (legacy / pre-import pages)", () => {
  const dto = rowToDTO(makeRow({ dataUrl: "" }));
  assert.deepEqual(dto.strokes, []);
});
