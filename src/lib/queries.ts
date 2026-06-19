import { supabase } from "@/integrations/supabase/client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { BookSearchResult } from "./book-search";

export type BookStatus = "queue" | "reading" | "paused" | "dropped" | "finished";
export type NoteType = "quote" | "text" | "photo" | "chapter" | "other" | "summary";

export interface BookRow {
  id: string;
  user_id: string;
  title: string;
  author: string | null;
  isbn: string | null;
  cover_url: string | null;
  description: string | null;
  page_count: number | null;
  published_date: string | null;
  category: string | null;
  status: BookStatus;
  current_page: number;
  rating: number | null;
  is_favourite: boolean;
  source: string;
  external_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface NoteRow {
  id: string;
  user_id: string;
  book_id: string | null;
  type: NoteType;
  title: string | null;
  content: string | null;
  quote_text: string | null;
  comment: string | null;
  page_number: number | null;
  chapter_number: number | null;
  chapter_title: string | null;
  image_path: string | null;
  is_favourite: boolean;
  created_at: string;
  updated_at: string;
}

// ============ BOOKS ============

export const booksQueryKey = ["books"] as const;
export function useBooks() {
  return useQuery({
    queryKey: booksQueryKey,
    queryFn: async (): Promise<BookRow[]> => {
      const { data, error } = await supabase
        .from("books")
        .select("*")
        .order("updated_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as BookRow[];
    },
  });
}

export function useBook(id: string | undefined) {
  return useQuery({
    queryKey: ["book", id],
    enabled: !!id,
    queryFn: async (): Promise<BookRow | null> => {
      const { data, error } = await supabase.from("books").select("*").eq("id", id!).maybeSingle();
      if (error) throw error;
      return data as BookRow | null;
    },
  });
}

export function useAddBook() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: BookSearchResult | Partial<BookRow>) => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) throw new Error("Not signed in");
      const isSearch = "external_id" in input && "source" in input;
      const insert = isSearch
        ? {
            user_id: u.user.id,
            title: input.title!,
            author: input.author ?? null,
            isbn: input.isbn ?? null,
            cover_url: input.cover_url ?? null,
            description: input.description ?? null,
            page_count: input.page_count ?? null,
            published_date: input.published_date ?? null,
            category: input.category ?? null,
            source: input.source!,
            external_id: input.external_id!,
            status: "queue" as BookStatus,
          }
        : { ...(input as Partial<BookRow>), user_id: u.user.id, source: "manual" };
      const { data, error } = await supabase
        .from("books")
        .insert(insert as never)
        .select()
        .single();
      if (error) throw error;
      return data as BookRow;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: booksQueryKey }),
  });
}

export function useUpdateBook() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Partial<BookRow> }) => {
      const { error } = await supabase
        .from("books")
        .update(patch as never)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: booksQueryKey });
      qc.invalidateQueries({ queryKey: ["book", vars.id] });
    },
  });
}

export function useDeleteBook() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("books").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: booksQueryKey }),
  });
}

// ============ NOTES ============

export const notesQueryKey = ["notes"] as const;
export function useNotes() {
  return useQuery({
    queryKey: notesQueryKey,
    queryFn: async (): Promise<NoteRow[]> => {
      const { data, error } = await supabase
        .from("notes")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as NoteRow[];
    },
  });
}

export function useNote(id: string | undefined) {
  return useQuery({
    queryKey: ["note", id],
    enabled: !!id && id !== "new",
    queryFn: async (): Promise<NoteRow | null> => {
      const { data, error } = await supabase.from("notes").select("*").eq("id", id!).maybeSingle();
      if (error) throw error;
      return data as NoteRow | null;
    },
  });
}

export function useSaveNote() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: Partial<NoteRow> & { id?: string }) => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) throw new Error("Not signed in");
      if (input.id) {
        const { id, ...patch } = input;
        const { data, error } = await supabase
          .from("notes")
          .update(patch as never)
          .eq("id", id)
          .select()
          .single();
        if (error) throw error;
        return data as NoteRow;
      } else {
        const insert = { ...input, user_id: u.user.id, type: input.type ?? "text" };
        const { data, error } = await supabase
          .from("notes")
          .insert(insert as never)
          .select()
          .single();
        if (error) throw error;
        return data as NoteRow;
      }
    },
    onSuccess: (n) => {
      qc.invalidateQueries({ queryKey: notesQueryKey });
      if (n) qc.invalidateQueries({ queryKey: ["note", n.id] });
    },
  });
}

export function useDeleteNote() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("notes").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: notesQueryKey }),
  });
}

// ============ STORAGE (page photos) ============

export async function uploadPagePhoto(file: File): Promise<string> {
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) throw new Error("Not signed in");
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "jpg";
  const path = `${u.user.id}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const { error } = await supabase.storage
    .from("book-assets")
    .upload(path, file, { upsert: false });
  if (error) throw error;
  return path;
}

export async function getSignedUrl(path: string): Promise<string | null> {
  const { data, error } = await supabase.storage.from("book-assets").createSignedUrl(path, 60 * 60);
  if (error) return null;
  return data.signedUrl;
}

// ============ SETTINGS ============

export interface UserSettings {
  user_id: string;
  theme: string;
  gigi_privacy: "off" | "current_book" | "notes_only" | "full" | "full_plus_chats";
  font: string | null;
  density: string | null;
}

export function useSettings() {
  return useQuery({
    queryKey: ["settings"],
    queryFn: async (): Promise<UserSettings | null> => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return null;
      const { data, error } = await supabase
        .from("user_settings")
        .select("*")
        .eq("user_id", u.user.id)
        .maybeSingle();
      if (error) throw error;
      if (!data) {
        // Auto-create row
        const { data: created, error: e2 } = await supabase
          .from("user_settings")
          .insert({ user_id: u.user.id } as never)
          .select()
          .single();
        if (e2) throw e2;
        return created as UserSettings;
      }
      return data as UserSettings;
    },
  });
}

export function useUpdateSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (patch: Partial<UserSettings>) => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) throw new Error("Not signed in");
      const { error } = await supabase
        .from("user_settings")
        .update(patch as never)
        .eq("user_id", u.user.id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["settings"] }),
  });
}
