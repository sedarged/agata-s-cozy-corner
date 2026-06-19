// mock-data.ts — shared type definitions + helpers.
// NOT a runtime source of truth. Runtime UI reads through the stores:
//   • books   → @/lib/books-store (getAllBooks / getEffectiveBookById / useBooksVersion)
//   • notes   → @/lib/notes-store (getAllNotes / getNotesForBook / getNoteById / useNotesVersion)
//   • reading → @/lib/book-workspace-store (getStoredSessions / getCombinedSessionsForBook)
// The seed arrays below (books / notes / sessions / initialGigiMessages) are intentionally
// EMPTY: the app ships with no demo/placeholder content and shows only the user's real data.
// (Add a non-empty array here only if you deliberately want bundled demo content.)
export type BookStatus = "reading" | "queue" | "finished" | "paused" | "dropped";

export interface Book {
  id: string;
  title: string;
  author: string;
  isbn: string;
  cover_url?: string | null;
  coverGradient: string;
  coverAccent: string;
  description: string;
  pageCount: number;
  currentPage: number;
  publishedDate: string;
  genre: string;
  status: BookStatus;
  rating?: number;
  isFavourite: boolean;
  tags: string[];
}

export const books: Book[] = [];

export type NoteType = "quote" | "note" | "page-photo" | "chapter" | "other";
export type NoteInputMode = "text" | "handwriting";
export type NoteBackground = "plain" | "lined" | "grid" | "cream" | "dark";

export interface Note {
  id: string;
  bookId: string;
  type: NoteType;
  title?: string;
  content: string;
  quoteText?: string;
  comment?: string;
  pageNumber?: number;
  chapterNumber?: number;
  chapterTitle?: string;
  photoUrl?: string;
  inputMode?: NoteInputMode;
  drawingDataUrl?: string;
  drawingBackground?: NoteBackground;
  isFavourite: boolean;
  tags: string[];
  createdAt: string;
  updatedAt?: string;
}

export const notes: Note[] = [];

export interface ReadingSession {
  id: string;
  bookId: string;
  date: string;
  durationMinutes: number;
  startPage: number;
  endPage: number;
}
export const sessions: ReadingSession[] = [];

export interface GigiMessage {
  id: string;
  role: "user" | "gigi";
  content: string;
}
export const initialGigiMessages: GigiMessage[] = [];

export const getBookById = (id: string) => books.find((b) => b.id === id);
export const getNotesByBook = (id: string) => notes.filter((n) => n.bookId === id);
export const getNotesByBookId = getNotesByBook;
export const getNotesByType = (bookId: string, type: NoteType) =>
  notes.filter((n) => n.bookId === bookId && n.type === type);
export const getReadingSessionsByBookId = (bookId: string) =>
  sessions.filter((s) => s.bookId === bookId);

export const bookStatusOptions = [
  { value: "queue", label: "W kolejce", description: "Książka czeka na przeczytanie." },
  { value: "started", label: "Zaczęte", description: "Aktualnie czytana książka." },
  { value: "paused", label: "Wstrzymane", description: "Czytanie zostało zatrzymane na później." },
  { value: "rejected", label: "Odrzucone", description: "Książka odłożona bez kończenia." },
  { value: "finished", label: "Przeczytane", description: "Książka została ukończona." },
] as const;

export type BookStatusKey = (typeof bookStatusOptions)[number]["value"];

export const statusToKey = (s: BookStatus): BookStatusKey => {
  switch (s) {
    case "reading":
      return "started";
    case "dropped":
      return "rejected";
    case "queue":
    case "paused":
    case "finished":
      return s;
  }
};

export const statusLabel = (s: BookStatus | BookStatusKey) => {
  const key = (s === "reading" ? "started" : s === "dropped" ? "rejected" : s) as BookStatusKey;
  return bookStatusOptions.find((o) => o.value === key)?.label ?? "—";
};

export const calculateBookStats = (bookId: string) => {
  const book = getBookById(bookId);
  const ses = getReadingSessionsByBookId(bookId);
  const totalMinutes = ses.reduce((a, s) => a + s.durationMinutes, 0);
  const pagesFromSessions = ses.reduce((a, s) => a + Math.max(0, s.endPage - s.startPage), 0);
  const uniqueDays = new Set(ses.map((s) => s.date)).size;
  const totalPages = book?.pageCount ?? 0;
  const currentPage = book?.currentPage ?? 0;
  const progress = totalPages > 0 ? Math.round((currentPage / totalPages) * 100) : 0;
  return {
    totalMinutes,
    pagesFromSessions,
    uniqueDays,
    totalPages,
    currentPage,
    progress,
    sessions: ses,
  };
};

export type SimpleNoteType = "quote" | "chapter" | "other";
export const simpleType = (t: NoteType): SimpleNoteType => {
  if (t === "quote") return "quote";
  if (t === "chapter") return "chapter";
  return "other";
};
export const noteTypeLabel = (t: SimpleNoteType) =>
  t === "quote" ? "Cytat" : t === "chapter" ? "Rozdział" : "Inne";

export const getNoteById = (id: string) => notes.find((n) => n.id === id);
export const getNotesBySimpleType = (bookId: string, t: SimpleNoteType) =>
  notes.filter((n) => n.bookId === bookId && simpleType(n.type) === t);
