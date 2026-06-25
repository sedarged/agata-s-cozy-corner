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
