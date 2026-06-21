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
};

// ---------- books ----------

export function useBooksQuery() {
  return useQuery({
    queryKey: qk.books,
    queryFn: () => booksApi.listBooks(),
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
  });
}

export function useNotesForBookQuery(bookId: string) {
  return useQuery({
    queryKey: qk.notesForBook(bookId),
    queryFn: () => notesApi.listNotesForBook({ data: { bookId } }),
    enabled: !!bookId,
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
  });
}

export function useCreateNoteMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: Parameters<typeof notesApi.createNote>[0]) => notesApi.createNote(input),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: qk.notes });
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
    },
  });
}

export function useDeleteNoteMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { id: string }) => notesApi.deleteNote({ data: { id: vars.id } }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: qk.notes });
    },
  });
}

// ---------- sessions ----------

export function useSessionsQuery() {
  return useQuery({
    queryKey: qk.sessions,
    queryFn: () => sessionsApi.listSessions(),
  });
}

export function useSessionsForBookQuery(bookId: string) {
  return useQuery({
    queryKey: qk.sessionsForBook(bookId),
    queryFn: () => sessionsApi.listSessionsForBook({ data: { bookId } }),
    enabled: !!bookId,
  });
}

export function useSessionsBetweenQuery(startISO: string, endISO: string) {
  return useQuery({
    queryKey: qk.sessionsBetween(startISO, endISO),
    queryFn: () => sessionsApi.listSessionsBetween({ data: { startISO, endISO } }),
    enabled: !!startISO && !!endISO,
  });
}

export function useCreateSessionMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: Parameters<typeof sessionsApi.createSession>[0]) =>
      sessionsApi.createSession(input),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: qk.sessions });
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
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: qk.sessions });
    },
  });
}

export function useDeleteSessionMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { id: string }) => sessionsApi.deleteSession({ data: { id: vars.id } }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: qk.sessions });
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
