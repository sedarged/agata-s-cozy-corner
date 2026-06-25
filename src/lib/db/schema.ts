// Agata — Drizzle schema (SQLite, single-user).
// Tables map to the existing localStorage stores. IDs are TEXT so the
// historical `local-…`/`note-…`/`rs-…` ids (see src/lib/utils.ts genId)
// keep working without rewriting migration data.
import { sql } from "drizzle-orm";
import { sqliteTable, text, integer, index } from "drizzle-orm/sqlite-core";

// ---------- books ----------
// One row per book. State fields (status, currentPage, rating, isFavourite,
// opinion, startedAt, finishedAt) live on the row itself — the localStorage
// `book_state` overlay collapses into the books table here.
export const books = sqliteTable("books", {
  id: text("id").primaryKey(),
  title: text("title").notNull(),
  author: text("author").notNull().default(""),
  isbn: text("isbn").notNull().default(""),
  coverUrl: text("cover_url"),
  coverGradient: text("cover_gradient").notNull().default("from-amber-100 to-rose-200"),
  coverAccent: text("cover_accent").notNull().default("#a16207"),
  description: text("description").notNull().default(""),
  pageCount: integer("page_count").notNull().default(0),
  currentPage: integer("current_page").notNull().default(0),
  publishedDate: text("published_date").notNull().default(""),
  genre: text("genre").notNull().default(""),
  // BookStatus: "reading" | "queue" | "finished" | "paused" | "dropped"
  status: text("status").notNull().default("queue"),
  rating: integer("rating"),
  isFavourite: integer("is_favourite", { mode: "boolean" }).notNull().default(false),
  tags: text("tags", { mode: "json" })
    .$type<string[]>()
    .notNull()
    .default(sql`'[]'`),
  publisher: text("publisher"),
  language: text("language"),
  seriesName: text("series_name"),
  seriesPart: text("series_part"),
  // "manual" | "openlibrary" | "google" | "bn" | "isbn" | "scan"
  source: text("source").notNull().default("manual"),
  opinion: text("opinion"),
  startedAt: text("started_at"),
  finishedAt: text("finished_at"),
  addedAt: text("added_at")
    .notNull()
    .default(sql`(strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))`),
  updatedAt: text("updated_at")
    .notNull()
    .default(sql`(strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))`),
});

// ---------- notes ----------
// Notes attached to a book. drawingDataUrl/photoUrl are kept for legacy
// compatibility but Phase 1 also moves binaries to the assets table (P2).
export const notes = sqliteTable(
  "notes",
  {
    id: text("id").primaryKey(),
    bookId: text("book_id")
      .notNull()
      .references(() => books.id, { onDelete: "cascade" }),
    // NoteType: "quote" | "note" | "page-photo" | "chapter" | "other"
    type: text("type").notNull(),
    title: text("title"),
    content: text("content").notNull().default(""),
    quoteText: text("quote_text"),
    comment: text("comment"),
    pageNumber: integer("page_number"),
    chapterNumber: integer("chapter_number"),
    chapterTitle: text("chapter_title"),
    photoUrl: text("photo_url"),
    // NoteInputMode: "text" | "handwriting"
    inputMode: text("input_mode"),
    drawingDataUrl: text("drawing_data_url"),
    // NoteBackground: "plain" | "lined" | "grid" | "cream" | "dark"
    drawingBackground: text("drawing_background"),
    isFavourite: integer("is_favourite", { mode: "boolean" }).notNull().default(false),
    tags: text("tags", { mode: "json" })
      .$type<string[]>()
      .notNull()
      .default(sql`'[]'`),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (t) => ({
    byBook: index("notes_book_id_idx").on(t.bookId),
  }),
);

// Tombstones for notes the user has deleted, kept so backup/import can
// reproduce the original "deleted ids" semantic on a clean DB.
export const notesDeleted = sqliteTable("notes_deleted", {
  id: text("id").primaryKey(),
  deletedAt: text("deleted_at")
    .notNull()
    .default(sql`(strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))`),
});

// ---------- reading_sessions ----------
export const readingSessions = sqliteTable(
  "reading_sessions",
  {
    id: text("id").primaryKey(),
    bookId: text("book_id")
      .notNull()
      .references(() => books.id, { onDelete: "cascade" }),
    date: text("date").notNull(),
    minutes: integer("minutes").notNull().default(0),
    pagesRead: integer("pages_read").notNull().default(0),
    startPage: integer("start_page").notNull().default(0),
    endPage: integer("end_page").notNull().default(0),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (t) => ({
    byBook: index("reading_sessions_book_id_idx").on(t.bookId),
    byDate: index("reading_sessions_date_idx").on(t.date),
  }),
);

// ---------- goals ----------
// Single-row table; id is always "default".
export const goals = sqliteTable("goals", {
  id: text("id").primaryKey(),
  yearlyBooks: integer("yearly_books").notNull().default(24),
  weeklyMinutes: integer("weekly_minutes").notNull().default(210),
  updatedAt: text("updated_at").notNull(),
});

// ---------- settings ----------
// Generic key-value store for preferences, Gigi privacy, encrypted user-pasted
// secrets (OpenAI API key from Settings), and any other small structured blob
// the app needs.
export const settings = sqliteTable("settings", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
  updatedAt: text("updated_at").notNull(),
});

// ---------- assets ----------
// Binary blobs (covers, drawings, page photos) stored on the filesystem
// under $DATA_DIR/assets/. Only the metadata lives in the DB.
export const assets = sqliteTable("assets", {
  id: text("id").primaryKey(),
  filename: text("filename").notNull(),
  mime: text("mime").notNull(),
  bytes: integer("bytes").notNull(),
  sha256: text("sha256").notNull().unique(),
  createdAt: text("created_at").notNull(),
});
