// Agata — React Query client-side hooks. The new canonical way to read and
// mutate data. The old `*-store.ts` modules stay as a backwards-compat shim
// for routes that haven't migrated yet (see CLAUDE.md, "Phase 1 migration").
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import * as booksApi from "@/lib/api/books.functions";
import * as notesApi from "@/lib/api/notes.functions";
import * as sessionsApi from "@/lib/api/sessions.functions";
import * as goalsApi from "@/lib/api/goals.functions";
import * as dbHealthApi from "@/lib/api/db-health.functions";
import * as importApi from "@/lib/api/import.functions";
import type { BackupPayload } from "@/lib/api/import-schema";
import { BookPatchSchema } from "@/lib/api/schemas";

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
  chatgptStatus: ["chatgpt", "status"] as const,
};

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
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: qk.books });
    },
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
  });
}

export function useDeleteBookMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { id: string }) => booksApi.deleteBook({ data: { id: vars.id } }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: qk.books });
    },
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
  });
}

// ---------- goals + settings ----------

export function useGoalsQuery() {
  return useQuery({
    queryKey: qk.goals,
    queryFn: () => goalsApi.getGoals(),
  });
}

export function useSetGoalsMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (patch: Parameters<typeof goalsApi.setGoals>[0]) => goalsApi.setGoals(patch),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: qk.goals });
    },
  });
}

export function useSettingQuery(key: string) {
  return useQuery({
    queryKey: ["settings", key] as const,
    queryFn: () => goalsApi.getSetting({ data: { key } }),
    enabled: !!key,
  });
}

export function useSetSettingMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { key: string; value: unknown }) => goalsApi.setSetting({ data: vars }),
    onSuccess: (_, vars) => {
      void qc.invalidateQueries({ queryKey: ["settings", vars.key] });
    },
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
  });
}

// ---------- chatgpt OAuth ----------

export interface ChatgptStatus {
  connected: boolean;
  accountId?: string;
  expiresAt?: number;
  hasRefreshToken?: boolean;
}

/**
 * Whether the user has a connected ChatGPT subscription (OAuth). Used by
 * the Gigi page (`src/routes/gigi.tsx`) to gate the chat UI behind an
 * OAuth-first landing — when the status says `connected: false`, the
 * page renders the OAuth connect card instead of the chat composer.
 *
 * Stays fresh (10s) so navigating back to Gigi after a successful
 * `disconnect` picks up the change without a full page reload. The
 * `retry: 1` caps transient network blips: a single failure falls
 * through to `error`, but two is treated as "still loading" — without
 * the cap, RQ's default of 3 would leave the user on the spinner for
 * ~3× the network timeout. The page reads `isError` indirectly by
 * treating `data === null` as "loading" (see `gigi-view-state.ts`).
 *
 * The matching mutation `invalidateChatgptStatus(qc)` lets the
 * `ChatGPTConnectCard` component force a refetch after a successful
 * connect/disconnect so the `/gigi` page picks up the new state on
 * next navigation, even within the 10s `staleTime` window.
 */
export function useChatgptStatusQuery() {
  return useQuery<ChatgptStatus>({
    queryKey: qk.chatgptStatus,
    queryFn: async () => {
      const res = await fetch("/api/chatgpt/status", { credentials: "same-origin" });
      if (!res.ok) throw new Error(`chatgpt-status ${res.status}`);
      return (await res.json()) as ChatgptStatus;
    },
    staleTime: 10_000,
    retry: 1,
  });
}

/**
 * Mark the chatgpt-status query as stale so the next consumer refetches.
 * Called by `ChatGPTConnectCard` after a successful connect / disconnect
 * so the Gigi page picks up the change on next navigation without
 * waiting for the 10s `staleTime` to elapse.
 */
export function invalidateChatgptStatus(qc: ReturnType<typeof useQueryClient>): void {
  void qc.invalidateQueries({ queryKey: qk.chatgptStatus });
}

// ---------- import (localStorage backup -> server) ----------

/** Dry-run: returns counts (books / notes / sessions / goals / drafts). */
export function useImportPreviewMutation() {
  return useMutation({
    mutationFn: (vars: { payload: BackupPayload }) =>
      importApi.previewImport({ data: { ...vars, mode: "preview" } }),
  });
}

/**
 * Write the backup payload to the server. Pass mode = "merge" or "replace".
 * On success, the caller is expected to invalidate books / notes / sessions /
 * goals so the UI refetches from the server.
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
  });
}
