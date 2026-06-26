// Agata — Zod schemas for server-function payloads. Shared by *.functions.ts + tests.
import { z } from "zod";

// Tight per-field caps: a malicious import payload (or just a typo'd 10 MB
// paste into a note) must not survive validation. Numbers are intentionally
// generous — the longest realistic input is a full-page transcription
// (~10-20 KB), so 20 KB notes / 2 KB tags / 256 B IDs leaves plenty of room.
const Tag = z.string().max(64);
const ShortStr = z.string().max(256);
const MedStr = z.string().max(2_000);
const LongStr = z.string().max(20_000);

export const BookStatus = z.enum(["reading", "queue", "finished", "paused", "dropped"]);
export const Source = z.enum(["manual", "openlibrary", "google", "bn", "isbn", "scan"]);

export const BookInputSchema = z.object({
  id: z.string().min(1).max(128),
  title: MedStr.min(1),
  author: MedStr.default(""),
  isbn: z.string().max(32).optional().default(""),
  coverUrl: z.string().max(2_000).nullable().optional(),
  coverGradient: z.string().max(64).optional(),
  coverAccent: z.string().max(64).optional(),
  description: LongStr.optional().default(""),
  pageCount: z.number().int().nonnegative().max(100_000).optional(),
  currentPage: z.number().int().nonnegative().max(100_000).optional(),
  publishedDate: ShortStr.optional().default(""),
  genre: MedStr.optional().default(""),
  status: BookStatus.optional(),
  rating: z.number().int().min(0).max(10).nullable().optional(),
  isFavourite: z.boolean().optional(),
  tags: z.array(Tag).max(64).optional(),
  publisher: MedStr.nullable().optional(),
  language: z.string().max(16).nullable().optional(),
  seriesName: MedStr.nullable().optional(),
  seriesPart: ShortStr.nullable().optional(),
  source: Source.optional(),
  opinion: LongStr.nullable().optional(),
  startedAt: z.string().max(40).nullable().optional(),
  finishedAt: z.string().max(40).nullable().optional(),
});

export const BookPatchSchema = BookInputSchema.partial().extend({ id: z.string().min(1).max(128) });

// ---------- notes ----------

export const NoteType = z.enum(["quote", "note", "page-photo", "chapter", "other"]);
export const InputMode = z.enum(["text", "handwriting"]).nullable().optional();
export const Background = z.enum(["plain", "lined", "grid", "cream", "dark"]).nullable().optional();

export const NoteInputSchema = z.object({
  id: z.string().min(1).max(128),
  bookId: z.string().min(1).max(128),
  type: NoteType,
  title: MedStr.nullable().optional(),
  content: LongStr.optional().default(""),
  quoteText: LongStr.nullable().optional(),
  comment: LongStr.nullable().optional(),
  pageNumber: z.number().int().nonnegative().max(1_000_000).nullable().optional(),
  chapterNumber: z.number().int().nonnegative().max(100_000).nullable().optional(),
  chapterTitle: MedStr.nullable().optional(),
  photoUrl: z.string().max(2_000).nullable().optional(),
  inputMode: InputMode,
  // Drawing data-URLs are base64-encoded PNGs; keep generous but bounded.
  drawingDataUrl: z.string().max(2_000_000).nullable().optional(),
  drawingBackground: Background,
  isFavourite: z.boolean().optional(),
  tags: z.array(Tag).max(64).optional(),
});

export const NotePatchSchema = NoteInputSchema.partial().extend({ id: z.string().min(1).max(128) });

// ---------- reading sessions ----------

export const SessionInputSchema = z.object({
  id: z.string().min(1).max(128),
  bookId: z.string().min(1).max(128),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "YYYY-MM-DD"),
  minutes: z.number().int().nonnegative().max(86_400),
  pagesRead: z.number().int().nonnegative().max(100_000),
  startPage: z.number().int().nonnegative().max(100_000),
  endPage: z.number().int().nonnegative().max(100_000),
});

export const SessionPatchSchema = SessionInputSchema.partial().extend({
  id: z.string().min(1).max(128),
});

// ---------- goals ----------

export const GoalsInputSchema = z.object({
  yearlyBooks: z.number().int().nonnegative().max(100_000).optional(),
  weeklyMinutes: z.number().int().nonnegative().max(100_000).optional(),
});

// ---------- chat ----------
// Gigi sends up to N messages per turn. Cap both to keep the upstream bill
// bounded and to satisfy provider-side per-request limits. The route
// (/api/chat) parses body.messages with `z.array(ChatMessageSchema).max(50)`;
// the rich `context` block is legacy localStorage-shaped and parsed separately.
const ChatContent = z.string().min(1).max(32_000);

export const ChatMessageSchema = z.object({
  role: z.enum(["user", "assistant", "system"]),
  content: ChatContent,
});

// --- Gigi persistent chat history ---
// All shapes mirror DB rows (`chat_sessions`, `chat_messages`) and the wire
// payloads the server functions accept. Caps reuse the existing helpers.

export const ChatMessageWireSchema = z.object({
  id: z.string().min(1).max(128),
  role: z.enum(["user", "assistant"]),
  content: ChatContent, // 32KB cap (matches ChatContent)
  createdAt: z.string().max(64),
});

export const ChatSessionSummarySchema = z.object({
  id: z.string().min(1).max(128),
  title: z.string().max(256).nullable(),
  createdAt: z.string().max(64),
  updatedAt: z.string().max(64),
});

export const ChatSessionDetailSchema = z.object({
  session: ChatSessionSummarySchema,
  messages: z.array(ChatMessageWireSchema).max(500), // cap persisted history
});

export const CreateChatInputSchema = z.object({
  id: z.string().min(1).max(128),
  title: z.string().max(256).nullable().optional(),
});

export const AppendMessageInputSchema = z.object({
  chatId: z.string().min(1).max(128),
  role: z.enum(["user", "assistant"]),
  content: ChatContent,
});

export const RenameChatInputSchema = z.object({
  chatId: z.string().min(1).max(128),
  title: z.string().min(1).max(256),
});

export const DeleteChatInputSchema = z.object({
  chatId: z.string().min(1).max(128),
});

// ---------- settings (generic k/v) ----------
// We accept `unknown` at the wire boundary; the repo JSON.stringify/parse-es it.
// Hard-cap the key so a hostile payload can't write 64 KB keys to the DB,
// and cap the JSON-serialised value to 4 KB so a single row stays well
// under the SQLite page size (H4 — bounds what `z.any()` used to allow).
const SETTING_VALUE_BYTES = 4_096;
const BoundedSettingValue = z.any().refine(
  (v) => {
    try {
      return JSON.stringify(v).length <= SETTING_VALUE_BYTES;
    } catch {
      return false;
    }
  },
  { message: `value exceeds ${SETTING_VALUE_BYTES} bytes when JSON-serialized` },
);
export const SettingKeySchema = z.object({ key: z.string().min(1).max(128) });
export const SettingPutSchema = z.object({
  key: z.string().min(1).max(128),
  value: BoundedSettingValue,
});

// ---- OpenAI API key (Settings → Prywatność i dostęp Gigi) ----

export const OPENAI_KEY_MODELS = [
  "gpt-5.4-mini",
  "gpt-5",
  "gpt-5-mini",
  "gpt-4.1",
  "gpt-4.1-mini",
  "gpt-4o-mini",
] as const;

export type OpenAIKeyModel = (typeof OPENAI_KEY_MODELS)[number];

export const OpenAIKeyInputSchema = z.object({
  apiKey: z
    .string()
    .trim()
    .min(20, "Klucz OpenAI jest za krótki")
    .max(256, "Klucz OpenAI jest za długi")
    .regex(
      /^sk-(proj-)?[A-Za-z0-9_-]+$/,
      "Nieprawidłowy format klucza OpenAI (powinien zaczynać się od sk- lub sk-proj-)",
    ),
  model: z.enum(OPENAI_KEY_MODELS),
});
