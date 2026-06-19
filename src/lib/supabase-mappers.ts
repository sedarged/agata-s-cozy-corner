// Supabase mappers — translate between the local app domain model
// (mock-data + local stores) and the Supabase database schema.
//
// These mappers DO NOT push or pull data. They prepare a future, controlled
// cloud sync stage. Wiring them up live requires:
//   - authenticated user
//   - valid Supabase config
//   - verified owner gate (app_config.owner_user_id)
//   - verified user-scoped RLS
//   - a local-id ↔ cloud-UUID mapping registry (see ID STRATEGY below)
//
// ID STRATEGY:
//   Local books use ids like "local-<timestamp>-<rand>" or numeric mock ids.
//   Supabase books.id is a UUID. We never write a "local-…" string into
//   books.id. Instead, the cloud row is created with the Supabase-generated
//   UUID, and we keep the local id in books.external_id (prefixed with
//   "agata-local:") plus a separate local→cloud id mapping in localStorage
//   (handled by cloud-sync, not here).
//
// NOTE TYPE MAPPING:
//   app quote      <-> db quote
//   app note       <-> db text
//   app page-photo <-> db photo
//   app chapter    <-> db chapter
//   app other      <-> db other
//   db summary     -> app other (no dedicated app type yet)

import type { Database } from "@/integrations/supabase/types";
import type { Book, BookStatus, Note, NoteType } from "@/lib/mock-data";
import type { StoredReadingSession, BookUserState } from "@/lib/book-workspace-store";

type DbBook = Database["public"]["Tables"]["books"]["Row"];
type DbBookInsert = Database["public"]["Tables"]["books"]["Insert"];
type DbBookUpdate = Database["public"]["Tables"]["books"]["Update"];

type DbNote = Database["public"]["Tables"]["notes"]["Row"];
type DbNoteInsert = Database["public"]["Tables"]["notes"]["Insert"];
type DbNoteUpdate = Database["public"]["Tables"]["notes"]["Update"];

type DbSession = Database["public"]["Tables"]["reading_sessions"]["Row"];
type DbSessionInsert = Database["public"]["Tables"]["reading_sessions"]["Insert"];
type DbSessionUpdate = Database["public"]["Tables"]["reading_sessions"]["Update"];

type DbRating = Database["public"]["Tables"]["ratings"]["Row"];
type DbRatingInsert = Database["public"]["Tables"]["ratings"]["Insert"];

type DbNoteType = Database["public"]["Enums"]["note_type"];
type DbBookStatus = Database["public"]["Enums"]["book_status"];

// ---------- helpers ----------

const safeInt = (n: unknown, fallback = 0): number => {
  const v = typeof n === "number" ? n : Number(n);
  return Number.isFinite(v) ? Math.round(v) : fallback;
};

const safeString = (s: unknown, fallback = ""): string => {
  if (typeof s !== "string") return fallback;
  return s;
};

const VALID_BOOK_STATUSES: BookStatus[] = ["reading", "queue", "finished", "paused", "dropped"];

const isBookStatus = (s: unknown): s is BookStatus =>
  typeof s === "string" && (VALID_BOOK_STATUSES as string[]).includes(s);

export const LOCAL_EXTERNAL_PREFIX = "agata-local:";

// ---------- note type mapping ----------

export function appNoteTypeToDb(t: NoteType): DbNoteType {
  switch (t) {
    case "quote":
      return "quote";
    case "note":
      return "text";
    case "page-photo":
      return "photo";
    case "chapter":
      return "chapter";
    case "other":
      return "other";
    default:
      return "other";
  }
}

export function dbNoteTypeToApp(t: DbNoteType): NoteType {
  switch (t) {
    case "quote":
      return "quote";
    case "text":
      return "note";
    case "photo":
      return "page-photo";
    case "chapter":
      return "chapter";
    case "other":
      return "other";
    case "summary":
      return "other"; // no dedicated app type
    default:
      return "other";
  }
}

// ---------- books ----------

export function dbBookToAppBook(row: DbBook): Book & {
  publishedDate: string;
  cloudId: string;
  externalId: string | null;
} {
  return {
    id: row.id, // cloud UUID; consumer decides which id to surface
    cloudId: row.id,
    externalId: row.external_id,
    title: safeString(row.title, "Brak tytułu"),
    author: safeString(row.author, "Brak autora"),
    isbn: safeString(row.isbn, ""),
    cover_url: row.cover_url ?? null,
    coverGradient: "linear-gradient(135deg,#c7d8e0,#7a96a8)",
    coverAccent: "#3a2418",
    description: safeString(row.description, ""),
    pageCount: safeInt(row.page_count, 0),
    currentPage: safeInt(row.current_page, 0),
    publishedDate: safeString(row.published_date, ""),
    genre: safeString(row.category, ""),
    status: isBookStatus(row.status) ? row.status : "queue",
    rating: row.rating ?? undefined,
    isFavourite: !!row.is_favourite,
    tags: [],
  };
}

export function appBookToDbInsert(book: Book, userId: string): DbBookInsert {
  const status = (VALID_BOOK_STATUSES as string[]).includes(book.status)
    ? (book.status as DbBookStatus)
    : "queue";
  return {
    user_id: userId,
    title: book.title,
    author: book.author || null,
    isbn: book.isbn || null,
    cover_url: book.cover_url ?? null,
    description: book.description || null,
    page_count: book.pageCount || null,
    current_page: book.currentPage || 0,
    published_date: book.publishedDate || null,
    category: book.genre || null,
    status,
    is_favourite: !!book.isFavourite,
    rating: book.rating ?? null,
    external_id: book.id.startsWith("local-") ? `${LOCAL_EXTERNAL_PREFIX}${book.id}` : book.id,
    source: "manual",
  };
}

export function appBookToDbUpdate(book: Partial<Book>): DbBookUpdate {
  const out: DbBookUpdate = {};
  if (book.title !== undefined) out.title = book.title;
  if (book.author !== undefined) out.author = book.author || null;
  if (book.isbn !== undefined) out.isbn = book.isbn || null;
  if (book.cover_url !== undefined) out.cover_url = book.cover_url ?? null;
  if (book.description !== undefined) out.description = book.description || null;
  if (book.pageCount !== undefined) out.page_count = book.pageCount || null;
  if (book.currentPage !== undefined) out.current_page = book.currentPage || 0;
  if (book.publishedDate !== undefined) out.published_date = book.publishedDate || null;
  if (book.genre !== undefined) out.category = book.genre || null;
  if (book.status !== undefined && (VALID_BOOK_STATUSES as string[]).includes(book.status)) {
    out.status = book.status as DbBookStatus;
  }
  if (book.isFavourite !== undefined) out.is_favourite = !!book.isFavourite;
  if (book.rating !== undefined) out.rating = book.rating ?? null;
  return out;
}

// ---------- notes ----------

export function dbNoteToAppNote(row: DbNote): Note {
  return {
    id: row.id,
    bookId: row.book_id ?? "",
    type: dbNoteTypeToApp(row.type),
    title: row.title ?? undefined,
    content: safeString(row.content, ""),
    quoteText: row.quote_text ?? undefined,
    comment: row.comment ?? undefined,
    pageNumber: row.page_number ?? undefined,
    chapterNumber: row.chapter_number ?? undefined,
    chapterTitle: row.chapter_title ?? undefined,
    photoUrl: row.image_path ?? undefined,
    isFavourite: !!row.is_favourite,
    tags: [],
    createdAt: row.created_at?.slice(0, 10) ?? "",
    updatedAt: row.updated_at ?? undefined,
  };
}

export function appNoteToDbInsert(
  note: Note,
  userId: string,
  cloudBookId: string | null,
): DbNoteInsert {
  // Handwriting drawings and base64 photos cannot be safely round-tripped
  // through `image_path` without a Storage upload — cloud-sync MUST refuse
  // to push these until a Storage strategy is in place.
  return {
    user_id: userId,
    book_id: cloudBookId,
    type: appNoteTypeToDb(note.type),
    title: note.title ?? null,
    content: note.content || null,
    quote_text: note.quoteText ?? null,
    comment: note.comment ?? null,
    page_number: note.pageNumber ?? null,
    chapter_number: note.chapterNumber ?? null,
    chapter_title: note.chapterTitle ?? null,
    image_path: note.photoUrl && !note.photoUrl.startsWith("data:") ? note.photoUrl : null,
    is_favourite: !!note.isFavourite,
  };
}

export function appNoteToDbUpdate(note: Partial<Note>, cloudBookId?: string | null): DbNoteUpdate {
  const out: DbNoteUpdate = {};
  if (cloudBookId !== undefined) out.book_id = cloudBookId;
  if (note.type !== undefined) out.type = appNoteTypeToDb(note.type);
  if (note.title !== undefined) out.title = note.title ?? null;
  if (note.content !== undefined) out.content = note.content || null;
  if (note.quoteText !== undefined) out.quote_text = note.quoteText ?? null;
  if (note.comment !== undefined) out.comment = note.comment ?? null;
  if (note.pageNumber !== undefined) out.page_number = note.pageNumber ?? null;
  if (note.chapterNumber !== undefined) out.chapter_number = note.chapterNumber ?? null;
  if (note.chapterTitle !== undefined) out.chapter_title = note.chapterTitle ?? null;
  if (note.photoUrl !== undefined) {
    out.image_path = note.photoUrl && !note.photoUrl.startsWith("data:") ? note.photoUrl : null;
  }
  if (note.isFavourite !== undefined) out.is_favourite = !!note.isFavourite;
  return out;
}

/**
 * Notes that hold inline drawings or base64 photos cannot be pushed safely.
 * cloud-sync uses this to flag affected rows in the readiness report.
 */
export function noteHasLocalOnlyMedia(note: Note): boolean {
  if (note.drawingDataUrl) return true;
  if (note.photoUrl && note.photoUrl.startsWith("data:")) return true;
  return false;
}

// ---------- reading sessions ----------

export function dbSessionToAppSession(row: DbSession): StoredReadingSession {
  const startPage = safeInt(row.start_page, 0);
  const endPage = safeInt(row.end_page, startPage);
  return {
    id: row.id,
    bookId: row.book_id,
    date: (row.started_at ?? row.created_at ?? "").slice(0, 10),
    minutes: safeInt(row.duration_minutes, 0),
    pagesRead: safeInt(row.pages_read, Math.max(0, endPage - startPage)),
    startPage,
    endPage,
    createdAt: row.created_at ?? new Date().toISOString(),
    updatedAt: row.created_at ?? new Date().toISOString(),
  };
}

export function appSessionToDbInsert(
  session: StoredReadingSession,
  userId: string,
  cloudBookId: string,
): DbSessionInsert {
  return {
    user_id: userId,
    book_id: cloudBookId,
    started_at: session.date ? new Date(session.date).toISOString() : new Date().toISOString(),
    duration_minutes: session.minutes,
    pages_read: session.pagesRead,
    start_page: session.startPage,
    end_page: session.endPage,
  };
}

export function appSessionToDbUpdate(
  session: Partial<StoredReadingSession>,
  cloudBookId?: string,
): DbSessionUpdate {
  const out: DbSessionUpdate = {};
  if (cloudBookId !== undefined) out.book_id = cloudBookId;
  if (session.date !== undefined) out.started_at = new Date(session.date).toISOString();
  if (session.minutes !== undefined) out.duration_minutes = session.minutes;
  if (session.pagesRead !== undefined) out.pages_read = session.pagesRead;
  if (session.startPage !== undefined) out.start_page = session.startPage;
  if (session.endPage !== undefined) out.end_page = session.endPage;
  return out;
}

// ---------- ratings / book state ----------

export function dbRatingToBookState(row: DbRating): Partial<BookUserState> {
  return {
    bookId: row.book_id,
    rating: row.overall ?? undefined,
    opinion: row.summary ?? undefined,
    updatedAt: row.updated_at,
  };
}

export function bookStateToRatingUpsert(
  cloudBookId: string,
  state: Partial<BookUserState>,
  userId: string,
): DbRatingInsert {
  return {
    user_id: userId,
    book_id: cloudBookId,
    overall: state.rating ?? null,
    summary: state.opinion ?? null,
  };
}
