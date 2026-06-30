// Agata — React Query client-side hooks. The new canonical way to read and
// mutate data. The old `*-store.ts` modules stay as a backwards-compat shim
// for routes that haven't migrated yet (see CLAUDE.md, "Phase 1 migration").
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { z } from "zod";
import * as booksApi from "@/lib/api/books.functions";
import * as notesApi from "@/lib/api/notes.functions";
import * as sessionsApi from "@/lib/api/sessions.functions";
import * as goalsApi from "@/lib/api/goals.functions";
import * as dbHealthApi from "@/lib/api/db-health.functions";
import * as importApi from "@/lib/api/import.functions";
import * as openaiKeyApi from "@/lib/api/openai-key.functions";
import * as chatsApi from "@/lib/api/chats.functions";
import type { BackupPayload } from "@/lib/api/import-schema";
import { BookPatchSchema, type OpenAIKeyModel } from "@/lib/api/schemas";
import { resolveMutationErrorMessage } from "@/lib/notify-mutation-error";

// ---------- query keys ----------

export const qk = {
  books: ["books"] as const,
  book: (id: string) => ["books", id] as const,
  notes: ["notes"] as const,
  notesForBook: (bookId: string) => ["notes", "book", bookId] as const,
  note: (id: string) => ["notes", id] as const,
  sessions: ["sessions"] as const,
  sessionsForBook: (bookId: string) => ["sessions", "book", bookId] as const,
  sessionsBetween: (start: string, end: string) => ["sessions", "between", start, end] as const,
  goals: ["goals"] as const,
  health: ["health"] as const,
  openaiKeyStatus: ["openai-key", "status"] as const,
  setting: (key: string) => ["settings", key] as const,
  chats: ["chats"] as const,
  chat: (id: string) => ["chats", id] as const,
  chatsForBook: (bookId: string) => ["chats", "book", bookId] as const,
  socialProof: (bookId: string) => ["social-proof", bookId] as const,
  handwritingPages: (noteId: string) => ["handwriting", "pages", noteId] as const,
};

// ---------- shared safety nets (H8 / H9) ----------

/**
 * H8 safety net: every mutation in this file routes its onError here so
 * fire-and-forget callers (and any caller that wraps in try/catch but
 * forgets to surface the error) still get a toast. Callers that need a
 * custom message can pass their own `onError` and skip this default.
 */
function defaultOnError(err: unknown): void {
  toast.error(resolveMutationErrorMessage(err, "Nie udało się zapisać"));
}

/**
 * H9: cap retries per query. 4xx responses are caller errors and never
 * benefit from retry; 5xx gets at most one retry so transient boot
 * hiccups don't leave the UI on a stale orange for 4 s.
 */
export function shouldRetry(failureCount: number, error: unknown): boolean {
  // Pull a status code out of the most common error shapes (fetch Response,
  // server-fn Error message of "openai-key-status 500", etc.).
  const msg = error instanceof Error ? error.message : String(error);
  const m = msg.match(/\b([1-5]\d{2})\b/);
  const status = m ? Number(m[1]) : 0;
  if (status >= 400 && status < 500) return false;
  return failureCount < 1;
}

// ---------- books ----------

// List/single-book queries share a 30s staleTime: this is a single-user app
// and the data changes only on explicit user action (add/edit/delete). A
// 30s window means that navigating between Library -> Book -> Library does
// not re-fire three RPCs while the user is just exploring.
const LIST_STALE_MS = 30_000;

export function useBooksQuery() {
  return useQuery({
    queryKey: qk.books,
    queryFn: () => booksApi.listBooks(),
    staleTime: LIST_STALE_MS,
  });
}

export function useBookQuery(id: string) {
  return useQuery({
    queryKey: qk.book(id),
    queryFn: async () => {
      const b = await booksApi.getBook({ data: { id } });
      return b ?? null;
    },
    enabled: !!id,
    staleTime: LIST_STALE_MS,
  });
}

export function useCreateBookMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: Parameters<typeof booksApi.upsertBook>[0]) => booksApi.upsertBook(input),
    onSuccess: (created, vars) => {
      void qc.invalidateQueries({ queryKey: qk.books });
      // M12: capture the returned id (or the input id when reusing an
      // existing row) and invalidate the single-book key too — the user
      // typically navigates straight to /book/$id after create.
      const id = (created as { id?: string } | undefined)?.id ?? vars?.data?.id;
      if (id) void qc.invalidateQueries({ queryKey: qk.book(id) });
    },
    onError: defaultOnError,
  });
}

export function useUpdateBookMutation() {
  const qc = useQueryClient();
  return useMutation({
    // Accepts a partial Book shape (no id needed — it goes in the wrapper).
    mutationFn: (vars: { id: string; patch: Omit<z.infer<typeof BookPatchSchema>, "id"> }) =>
      booksApi.patchBook({ data: { id: vars.id, ...vars.patch } }),
    onSuccess: (_, vars) => {
      void qc.invalidateQueries({ queryKey: qk.books });
      void qc.invalidateQueries({ queryKey: qk.book(vars.id) });
    },
    onError: defaultOnError,
  });
}

export function useDeleteBookMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { id: string }) => booksApi.deleteBook({ data: { id: vars.id } }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: qk.books });
    },
    onError: defaultOnError,
  });
}

export function useBumpCurrentPageMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { id: string; currentPage: number }) =>
      booksApi.bumpCurrentPage({ data: vars }),
    onSuccess: (_, vars) => {
      void qc.invalidateQueries({ queryKey: qk.books });
      void qc.invalidateQueries({ queryKey: qk.book(vars.id) });
    },
    onError: defaultOnError,
  });
}

/**
 * Pin a user-uploaded cover for a book. The data URL must be ≤ 2 MB and
 * start with `data:image/…`; the repo rejects anything else.
 *
 * Invalidation: list + single-book. The cover is the most visible bit of
 * state on the row, so the home grid must refetch too.
 */
export function useSetManualCoverMutation() {
  const qc = useQueryClient();
  return useMutation({
    // Flat input — caller passes { id, dataUrl }; we wrap as the server-fn
    // payload shape internally. Matches useUpdateBookMutation's ergonomics.
    mutationFn: (vars: { id: string; dataUrl: string }) => booksApi.setManualCover({ data: vars }),
    onSuccess: (_, vars) => {
      void qc.invalidateQueries({ queryKey: qk.books });
      void qc.invalidateQueries({ queryKey: qk.book(vars.id) });
    },
    onError: defaultOnError,
  });
}

/**
 * Drop the manual cover override. After this the API-derived `coverUrl`
 * (or the gradient placeholder) takes over again.
 */
export function useClearManualCoverMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { id: string }) => booksApi.clearManualCover({ data: vars }),
    onSuccess: (_, vars) => {
      void qc.invalidateQueries({ queryKey: qk.books });
      void qc.invalidateQueries({ queryKey: qk.book(vars.id) });
    },
    onError: defaultOnError,
  });
}

// ---------- notes ----------

export function useNotesQuery() {
  return useQuery({
    queryKey: qk.notes,
    queryFn: () => notesApi.listNotes(),
    staleTime: LIST_STALE_MS,
  });
}

export function useNotesForBookQuery(bookId: string) {
  return useQuery({
    queryKey: qk.notesForBook(bookId),
    queryFn: () => notesApi.listNotesForBook({ data: { bookId } }),
    enabled: !!bookId,
    staleTime: LIST_STALE_MS,
  });
}

/** Single note by id. Returns `null` while loading or when missing. */
export function useNoteQuery(id: string) {
  return useQuery({
    queryKey: qk.note(id),
    queryFn: async () => {
      const n = await notesApi.getNote({ data: { id } });
      return n ?? null;
    },
    enabled: !!id,
    staleTime: LIST_STALE_MS,
  });
}

export function useCreateNoteMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: Parameters<typeof notesApi.createNote>[0]) => notesApi.createNote(input),
    onSuccess: (_, vars) => {
      void qc.invalidateQueries({ queryKey: qk.notes });
      // Invalidate the per-book list so the book-detail tabs strip refetches
      // and surfaces the new note. The server returns the bookId, so we
      // can target the specific key without scanning.
      const bookId = (vars as { data?: { bookId?: string } }).data?.bookId;
      if (bookId) void qc.invalidateQueries({ queryKey: qk.notesForBook(bookId) });
    },
    onError: defaultOnError,
  });
}

export function useUpdateNoteMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { id: string; patch: Parameters<typeof notesApi.patchNote>[0] }) =>
      notesApi.patchNote(vars.patch),
    onSuccess: (_, vars) => {
      void qc.invalidateQueries({ queryKey: qk.notes });
      void qc.invalidateQueries({ queryKey: qk.note(vars.id) });
      // patch shape matches the create shape; re-invalidating the
      // bookId-scoped key keeps the tabs strip fresh if the note moved
      // between books (rare, but possible).
      const bookId = vars.patch?.data?.bookId;
      if (bookId) void qc.invalidateQueries({ queryKey: qk.notesForBook(bookId) });
    },
    onError: defaultOnError,
  });
}

export function useDeleteNoteMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { id: string; bookId?: string }) =>
      notesApi.deleteNote({ data: { id: vars.id } }),
    onSuccess: (_, vars) => {
      void qc.invalidateQueries({ queryKey: qk.notes });
      void qc.invalidateQueries({ queryKey: qk.note(vars.id) });
      if (vars.bookId) void qc.invalidateQueries({ queryKey: qk.notesForBook(vars.bookId) });
    },
    onError: defaultOnError,
  });
}

// ---------- sessions ----------

export function useSessionsQuery() {
  return useQuery({
    queryKey: qk.sessions,
    queryFn: () => sessionsApi.listSessions(),
    staleTime: LIST_STALE_MS,
  });
}

export function useSessionsForBookQuery(bookId: string) {
  return useQuery({
    queryKey: qk.sessionsForBook(bookId),
    queryFn: () => sessionsApi.listSessionsForBook({ data: { bookId } }),
    enabled: !!bookId,
    staleTime: LIST_STALE_MS,
  });
}

export function useSessionsBetweenQuery(startISO: string, endISO: string) {
  return useQuery({
    queryKey: qk.sessionsBetween(startISO, endISO),
    queryFn: () => sessionsApi.listSessionsBetween({ data: { startISO, endISO } }),
    enabled: !!startISO && !!endISO,
    staleTime: LIST_STALE_MS,
  });
}

export function useCreateSessionMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: Parameters<typeof sessionsApi.createSession>[0]) =>
      sessionsApi.createSession(input),
    onSuccess: (_, vars) => {
      void qc.invalidateQueries({ queryKey: qk.sessions });
      // Invalidate the per-book session list so the stats / read views
      // pick up the new session without a full reload.
      const bookId = (vars as { data?: { bookId?: string } }).data?.bookId;
      if (bookId) void qc.invalidateQueries({ queryKey: qk.sessionsForBook(bookId) });
    },
    onError: defaultOnError,
  });
}

export function usePatchSessionMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: {
      id: string;
      patch: Partial<Omit<Parameters<typeof sessionsApi.createSession>[0]["data"], "id">>;
    }) => sessionsApi.patchSession({ data: { id: vars.id, ...vars.patch } }),
    onSuccess: (_, vars) => {
      void qc.invalidateQueries({ queryKey: qk.sessions });
      if (vars.patch?.bookId) {
        void qc.invalidateQueries({ queryKey: qk.sessionsForBook(vars.patch.bookId) });
      }
    },
    onError: defaultOnError,
  });
}

export function useDeleteSessionMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { id: string; bookId?: string }) =>
      sessionsApi.deleteSession({ data: { id: vars.id } }),
    onSuccess: (_, vars) => {
      void qc.invalidateQueries({ queryKey: qk.sessions });
      if (vars.bookId) void qc.invalidateQueries({ queryKey: qk.sessionsForBook(vars.bookId) });
    },
    onError: defaultOnError,
  });
}

// ---------- goals + settings ----------

export function useGoalsQuery() {
  return useQuery({
    queryKey: qk.goals,
    queryFn: () => goalsApi.getGoals(),
    staleTime: LIST_STALE_MS,
  });
}

export function useSetGoalsMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (patch: Parameters<typeof goalsApi.setGoals>[0]) => goalsApi.setGoals(patch),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: qk.goals });
    },
    onError: defaultOnError,
  });
}

export function useSettingQuery(key: string) {
  return useQuery({
    queryKey: qk.setting(key),
    queryFn: () => goalsApi.getSetting({ data: { key } }),
    enabled: !!key,
    staleTime: LIST_STALE_MS,
  });
}

export function useSetSettingMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { key: string; value: unknown }) => goalsApi.setSetting({ data: vars }),
    onSuccess: (_, vars) => {
      void qc.invalidateQueries({ queryKey: qk.setting(vars.key) });
    },
    onError: defaultOnError,
  });
}

// ---------- health ----------

export function useDbHealthQuery() {
  return useQuery({
    queryKey: qk.health,
    queryFn: () => dbHealthApi.getServerHealth(),
    // Health check is cheap; refresh on focus for an at-a-glance status.
    refetchOnWindowFocus: true,
    staleTime: 10_000,
    // H9: cap retries so transient 5xx during reboot clears within 1-2s
    // instead of leaving the UI on stale orange for 4s (RQ default = 3).
    retry: shouldRetry,
  });
}

// ---------- import (localStorage backup -> server) ----------

/** Dry-run: returns counts (books / notes / sessions / goals / drafts). */
export function useImportPreviewMutation() {
  return useMutation({
    mutationFn: (vars: { payload: BackupPayload }) =>
      importApi.previewImport({ data: { ...vars, mode: "preview" } }),
    onError: defaultOnError,
  });
}

/**
 * Write the backup payload to the server (mode = "merge" or "replace").
 * On success, this hook itself invalidates books / notes / sessions / goals
 * — the caller does not need to do that anymore (M10: docstring used to
 * push that work onto the caller, which dropped sessions frequently).
 */
export function useImportApplyMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { payload: BackupPayload; mode: "merge" | "replace" }) =>
      importApi.applyImport({ data: vars }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: qk.books });
      void qc.invalidateQueries({ queryKey: qk.notes });
      void qc.invalidateQueries({ queryKey: qk.sessions });
      void qc.invalidateQueries({ queryKey: qk.goals });
    },
    onError: defaultOnError,
  });
}

// ---------- openai api key ----------

export interface OpenAIKeyStatus {
  configured: boolean;
  source: "env" | "stored" | "none";
  model?: string;
  masked?: string;
}

export function useOpenAIKeyStatusQuery() {
  return useQuery<OpenAIKeyStatus>({
    queryKey: qk.openaiKeyStatus,
    queryFn: async () => {
      const res = await fetch("/api/openai-key/status", { credentials: "same-origin" });
      if (!res.ok) throw new Error(`openai-key-status ${res.status}`);
      return (await res.json()) as OpenAIKeyStatus;
    },
    staleTime: 10_000,
    retry: shouldRetry,
  });
}

export function invalidateOpenAIKeyStatus(qc: ReturnType<typeof useQueryClient>): void {
  void qc.invalidateQueries({ queryKey: qk.openaiKeyStatus });
}

export function useSaveOpenAIKeyMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { apiKey: string; model: OpenAIKeyModel }) =>
      openaiKeyApi.saveOpenAIKey({ data: vars }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: qk.openaiKeyStatus });
    },
    onError: defaultOnError,
  });
}

export function useDeleteOpenAIKeyMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => openaiKeyApi.deleteOpenAIKey(),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: qk.openaiKeyStatus });
    },
    onError: defaultOnError,
  });
}

// ---------- Gigi persistent chat history ----------

export function useChatsQuery() {
  return useQuery({
    queryKey: qk.chats,
    queryFn: () => chatsApi.listChats(),
    staleTime: LIST_STALE_MS,
  });
}

/**
 * List Gigi chats tagged with a specific book. Powers the "previous chats
 * about this book" surface on the book detail page. Empty list when no
 * chat has been linked to this book yet.
 */
export function useChatsForBookQuery(bookId: string | null | undefined) {
  return useQuery({
    queryKey: bookId ? qk.chatsForBook(bookId) : qk.chatsForBook("__none__"),
    queryFn: async () => {
      if (!bookId) return [];
      // The repo function lives in `@/lib/db/repositories/chats` and isn't
      // exposed via `*.functions.ts` — we round-trip through the existing
      // listChats server fn and filter by bookId on the client. The list
      // is bounded (load-bearing for the sidebar), so this stays cheap.
      const all = await chatsApi.listChats();
      return all.filter((c) => c.bookId === bookId);
    },
    enabled: !!bookId,
    staleTime: LIST_STALE_MS,
  });
}

export function useChatQuery(chatId: string | null) {
  return useQuery({
    queryKey: chatId ? qk.chat(chatId) : qk.chat("__none__"),
    queryFn: () => {
      if (!chatId) throw new Error("chatId required");
      return chatsApi.getChat({ data: { chatId } });
    },
    enabled: !!chatId,
    staleTime: LIST_STALE_MS,
  });
}

export function useCreateChatMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { id: string; title?: string | null; bookId?: string | null }) =>
      chatsApi.createChat({ data: input }),
    onSuccess: (session) => {
      void qc.invalidateQueries({ queryKey: qk.chats });
      // Invalidate the per-book chats cache too so the "previous chats
      // about this book" surface on the book detail page refetches.
      if (session.bookId) {
        void qc.invalidateQueries({ queryKey: qk.chatsForBook(session.bookId) });
      }
      qc.setQueryData(qk.chat(session.id), { session, messages: [] });
    },
    onError: defaultOnError,
    retry: shouldRetry,
  });
}

export function useAppendMessageMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { chatId: string; role: "user" | "assistant"; content: string }) =>
      chatsApi.appendMessage({ data: input }),
    onSuccess: (_msg, vars) => {
      void qc.invalidateQueries({ queryKey: qk.chat(vars.chatId) });
      void qc.invalidateQueries({ queryKey: qk.chats });
    },
    onError: defaultOnError,
    retry: shouldRetry,
  });
}

export function useRenameChatMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { chatId: string; title: string }) => chatsApi.renameChat({ data: input }),
    onSuccess: (session) => {
      void qc.invalidateQueries({ queryKey: qk.chats });
      qc.setQueryData(qk.chat(session.id), (prev: unknown) => {
        if (!prev || typeof prev !== "object") return prev;
        return { ...(prev as Record<string, unknown>), session };
      });
    },
    onError: defaultOnError,
    retry: shouldRetry,
  });
}

export function useDeleteChatMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { chatId: string }) => chatsApi.deleteChat({ data: input }),
    onSuccess: (_void, vars) => {
      void qc.invalidateQueries({ queryKey: qk.chats });
      qc.removeQueries({ queryKey: qk.chat(vars.chatId) });
    },
    onError: defaultOnError,
    retry: shouldRetry,
  });
}

// ---------- social proof (Hardcover-backed, mock-first) ----------

// Local DTO re-declared here so client code doesn't need to import from a
// `.server.ts` module (which would fail at build). The server route returns
// exactly this shape.
export interface BookSocialProofDTO {
  bookId: string;
  averageRating?: number;
  ratingsCount?: number;
  reviewsCount?: number;
  ratingDistribution?: {
    oneStar?: number;
    twoStar?: number;
    threeStar?: number;
    fourStar?: number;
    fiveStar?: number;
  };
  reviewHighlights: Array<{
    id: string;
    source: "hardcover" | "google" | "openlibrary" | "nyt" | "librarything";
    reviewerName?: string;
    rating?: number;
    text?: string;
    summary?: string;
    url?: string;
    containsSpoilers?: boolean;
    reviewType: "reader" | "critic" | "tag";
    publishedAt?: string;
  }>;
  sources: {
    hardcover?: boolean;
    googleBooks?: boolean;
    openLibrary?: boolean;
    nyt?: boolean;
    libraryThing?: boolean;
  };
  lastFetchedAt: string;
}

async function fetchSocialProof(bookId: string): Promise<BookSocialProofDTO> {
  const r = await fetch(`/api/books/${encodeURIComponent(bookId)}/social-proof`);
  if (!r.ok) throw new Error(`social-proof ${r.status}`);
  return (await r.json()) as BookSocialProofDTO;
}

export function useBookSocialProofQuery(bookId: string | null | undefined) {
  return useQuery({
    queryKey: bookId ? qk.socialProof(bookId) : ["social-proof", "__none__"],
    queryFn: () => fetchSocialProof(bookId as string),
    enabled: !!bookId,
    staleTime: 30_000,
    retry: shouldRetry,
  });
}

// ---------- handwriting (multi-page notebook) ----------

// DTO mirrors `HandwritingPage` from src/lib/db/repositories/handwriting.ts.
// Re-declared here so client code doesn't pull from a server-only repo.
export interface HandwritingPageDTO {
  id: string;
  noteId: string;
  pageIndex: number;
  strokes: unknown; // JSON-serialised stroke array
  background: string;
  createdAt: string;
  updatedAt: string;
}

async function fetchHandwritingPages(noteId: string): Promise<HandwritingPageDTO[]> {
  const r = await fetch(`/api/notes/${encodeURIComponent(noteId)}/handwriting/pages`);
  if (!r.ok) throw new Error(`handwriting pages ${r.status}`);
  return (await r.json()) as HandwritingPageDTO[];
}

export function useHandwritingPagesQuery(noteId: string | null | undefined) {
  return useQuery({
    queryKey: noteId ? qk.handwritingPages(noteId) : ["handwriting", "pages", "__none__"],
    queryFn: () => fetchHandwritingPages(noteId as string),
    enabled: !!noteId,
    staleTime: 30_000,
    retry: shouldRetry,
  });
}

async function saveHandwritingPage(input: HandwritingPageDTO): Promise<HandwritingPageDTO> {
  const r = await fetch(`/api/notes/${encodeURIComponent(input.noteId)}/handwriting/pages`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!r.ok) throw new Error(`handwriting save ${r.status}`);
  return (await r.json()) as HandwritingPageDTO;
}

export function useSaveHandwritingPageMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: HandwritingPageDTO) => saveHandwritingPage(input),
    onSuccess: (page) => {
      void qc.invalidateQueries({ queryKey: qk.handwritingPages(page.noteId) });
    },
    onError: defaultOnError,
    retry: shouldRetry,
  });
}

async function deleteHandwritingPage(noteId: string, pageId: string): Promise<void> {
  const r = await fetch(
    `/api/notes/${encodeURIComponent(noteId)}/handwriting/pages/${encodeURIComponent(pageId)}`,
    { method: "DELETE" },
  );
  if (!r.ok) throw new Error(`handwriting delete ${r.status}`);
}

export function useDeleteHandwritingPageMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { noteId: string; pageId: string }) =>
      deleteHandwritingPage(input.noteId, input.pageId),
    onSuccess: (_void, vars) => {
      void qc.invalidateQueries({ queryKey: qk.handwritingPages(vars.noteId) });
    },
    onError: defaultOnError,
    retry: shouldRetry,
  });
}
