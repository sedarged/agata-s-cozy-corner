// Agata — Zod schemas for server-function payloads. Shared by *.functions.ts + tests.
import { z } from "zod";

export const BookStatus = z.enum(["reading", "queue", "finished", "paused", "dropped"]);
export const Source = z.enum(["manual", "openlibrary", "google", "bn", "isbn", "scan"]);

export const BookInputSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  author: z.string().default(""),
  isbn: z.string().optional().default(""),
  coverUrl: z.string().nullable().optional(),
  coverGradient: z.string().optional(),
  coverAccent: z.string().optional(),
  description: z.string().optional().default(""),
  pageCount: z.number().int().nonnegative().optional(),
  currentPage: z.number().int().nonnegative().optional(),
  publishedDate: z.string().optional().default(""),
  genre: z.string().optional().default(""),
  status: BookStatus.optional(),
  rating: z.number().int().nullable().optional(),
  isFavourite: z.boolean().optional(),
  tags: z.array(z.string()).optional(),
  publisher: z.string().nullable().optional(),
  language: z.string().nullable().optional(),
  seriesName: z.string().nullable().optional(),
  seriesPart: z.string().nullable().optional(),
  source: Source.optional(),
  opinion: z.string().nullable().optional(),
  startedAt: z.string().nullable().optional(),
  finishedAt: z.string().nullable().optional(),
});

export const BookPatchSchema = BookInputSchema.partial().extend({ id: z.string().min(1) });

// ---------- notes ----------

export const NoteType = z.enum(["quote", "note", "page-photo", "chapter", "other"]);
export const InputMode = z.enum(["text", "handwriting"]).nullable().optional();
export const Background = z.enum(["plain", "lined", "grid", "cream", "dark"]).nullable().optional();

export const NoteInputSchema = z.object({
  id: z.string().min(1),
  bookId: z.string().min(1),
  type: NoteType,
  title: z.string().nullable().optional(),
  content: z.string().optional().default(""),
  quoteText: z.string().nullable().optional(),
  comment: z.string().nullable().optional(),
  pageNumber: z.number().int().nullable().optional(),
  chapterNumber: z.number().int().nullable().optional(),
  chapterTitle: z.string().nullable().optional(),
  photoUrl: z.string().nullable().optional(),
  inputMode: InputMode,
  drawingDataUrl: z.string().nullable().optional(),
  drawingBackground: Background,
  isFavourite: z.boolean().optional(),
  tags: z.array(z.string()).optional(),
});

export const NotePatchSchema = NoteInputSchema.partial().extend({ id: z.string().min(1) });

// ---------- reading sessions ----------

export const SessionInputSchema = z.object({
  id: z.string().min(1),
  bookId: z.string().min(1),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "YYYY-MM-DD"),
  minutes: z.number().int().nonnegative(),
  pagesRead: z.number().int().nonnegative(),
  startPage: z.number().int().nonnegative(),
  endPage: z.number().int().nonnegative(),
});

export const SessionPatchSchema = SessionInputSchema.partial().extend({ id: z.string().min(1) });

// ---------- goals ----------

export const GoalsInputSchema = z.object({
  yearlyBooks: z.number().int().nonnegative().optional(),
  weeklyMinutes: z.number().int().nonnegative().optional(),
});

// ---------- settings (generic k/v) ----------
// We accept `unknown` at the wire boundary; the repo JSON.stringify/parse-es it.
// `z.any()` keeps TanStack's serializer happy (it rejects z.unknown()).
export const SettingKeySchema = z.object({ key: z.string().min(1) });
export const SettingPutSchema = z.object({ key: z.string(), value: z.any() });
