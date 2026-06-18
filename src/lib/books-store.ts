import { useSyncExternalStore } from "react";
import { books as mockBooks, type Book, type BookStatus } from "./mock-data";
import { gradientFor, paletteFor } from "./cover";
import { emitQuotaEvent } from "./backup";

export const BOOKS_KEY = "agata-books-v1";

interface StoredShape {
  localBooks: Book[];
  overrides: Record<string, Partial<Book>>;
  deletedIds: string[];
}

const empty: StoredShape = { localBooks: [], overrides: {}, deletedIds: [] };

const isClient = () => typeof window !== "undefined";
const nowIso = () => new Date().toISOString();

type Listener = () => void;
const listeners = new Set<Listener>();
let version = 0;
const bump = () => {
  version++;
  listeners.forEach((l) => l());
};

export function getStoredBooks(): StoredShape {
  if (!isClient()) return empty;
  try {
    const raw = window.localStorage.getItem(BOOKS_KEY);
    if (!raw) return { ...empty };
    const v = JSON.parse(raw);
    return {
      localBooks: Array.isArray(v?.localBooks) ? v.localBooks : [],
      overrides: v?.overrides && typeof v.overrides === "object" ? v.overrides : {},
      deletedIds: Array.isArray(v?.deletedIds) ? v.deletedIds : [],
    };
  } catch {
    return { ...empty };
  }
}

export function saveStoredBooks(data: StoredShape): { ok: boolean; quota?: boolean } {
  if (!isClient()) return { ok: false };
  try {
    window.localStorage.setItem(BOOKS_KEY, JSON.stringify(data));
    bump();
    return { ok: true };
  } catch (e) {
    const quota = e instanceof Error && /quota|exceeded/i.test(e.message);
    if (quota) emitQuotaEvent("books");
    return { ok: false, quota };
  }
}

function applyOverride(b: Book, ov?: Partial<Book>): Book {
  if (!ov) return b;
  return { ...b, ...ov } as Book;
}

export function getAllBooks(): Book[] {
  const s = getStoredBooks();
  const deleted = new Set(s.deletedIds);
  const fromMock = mockBooks
    .filter((b) => !deleted.has(b.id))
    .map((b) => applyOverride(b, s.overrides[b.id]));
  const fromLocal = s.localBooks.filter((b) => !deleted.has(b.id));
  return [...fromLocal, ...fromMock];
}

export function getBookByIdLocal(id: string): Book | undefined {
  return getStoredBooks().localBooks.find((b) => b.id === id);
}

export function getEffectiveBookById(id: string): Book | undefined {
  const s = getStoredBooks();
  if (s.deletedIds.includes(id)) return undefined;
  const local = s.localBooks.find((b) => b.id === id);
  if (local) return applyOverride(local, s.overrides[id]);
  const mock = mockBooks.find((b) => b.id === id);
  if (!mock) return undefined;
  return applyOverride(mock, s.overrides[id]);
}

function normalize(s: string) {
  return (s || "")
    .toString()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // strip diacritics
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ") // strip punctuation incl. „"'!?:;,
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeIsbn(s: string) {
  return (s || "").replace(/[^0-9Xx]/g, "");
}

function authorLastName(a: string): string {
  const parts = normalize(a).split(" ").filter(Boolean);
  return parts[parts.length - 1] || "";
}

export function isDuplicateBook(input: {
  isbn?: string;
  title?: string;
  author?: string;
}): Book | undefined {
  const all = getAllBooks();
  const isbn = normalizeIsbn(input.isbn || "");
  if (isbn) {
    const hit = all.find((b) => normalizeIsbn(b.isbn || "") === isbn);
    if (hit) return hit;
  }
  const t = normalize(input.title || "");
  const a = normalize(input.author || "");
  if (!t) return undefined;
  // Exact normalized title + author match
  if (a) {
    const exact = all.find((b) => normalize(b.title) === t && normalize(b.author) === a);
    if (exact) return exact;
    // Title match + same author last name (handles "Toshikazu Kawaguchi" vs "Kawaguchi")
    const last = authorLastName(input.author || "");
    if (last) {
      const fuzzy = all.find(
        (b) => normalize(b.title) === t && authorLastName(b.author) === last,
      );
      if (fuzzy) return fuzzy;
    }
  } else {
    const titleOnly = all.find((b) => normalize(b.title) === t);
    if (titleOnly) return titleOnly;
  }
  return undefined;
}

function newId() {
  return `local-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export interface CreateBookInput {
  title: string;
  author: string;
  isbn?: string;
  cover_url?: string | null;
  description?: string;
  pageCount?: number;
  publishedDate?: string;
  genre?: string;
  status?: BookStatus;
  isFavourite?: boolean;
  tags?: string[];
  publisher?: string;
  language?: string;
  seriesName?: string;
  seriesPart?: string;
  source?: "manual" | "openlibrary" | "isbn" | "scan";
}

export interface CreateBookResult {
  ok: boolean;
  book?: Book;
  quota?: boolean;
  error?: string;
}

export function createBook(input: CreateBookInput): CreateBookResult {
  if (!input.title?.trim()) return { ok: false, error: "Tytuł jest wymagany" };
  if (!input.author?.trim()) return { ok: false, error: "Autor jest wymagany" };
  const seed = `${input.title}-${input.author}`;
  const palette = paletteFor(seed);
  const id = newId();
  const book: Book & {
    publisher?: string;
    language?: string;
    seriesName?: string;
    seriesPart?: string;
    source?: string;
    addedAt?: string;
    updatedAt?: string;
  } = {
    id,
    title: input.title.trim(),
    author: input.author.trim(),
    isbn: (input.isbn || "").trim(),
    cover_url: input.cover_url ?? null,
    coverGradient: gradientFor(seed),
    coverAccent: palette.accent,
    description: input.description?.trim() || "",
    pageCount: Math.max(0, Math.round(input.pageCount || 0)),
    currentPage: 0,
    publishedDate: input.publishedDate?.trim() || "",
    genre: input.genre?.trim() || "",
    status: input.status || "queue",
    isFavourite: !!input.isFavourite,
    tags: input.tags || [],
    publisher: input.publisher?.trim() || undefined,
    language: input.language?.trim() || undefined,
    seriesName: input.seriesName?.trim() || undefined,
    seriesPart: input.seriesPart?.trim() || undefined,
    source: input.source || "manual",
    addedAt: nowIso(),
    updatedAt: nowIso(),
  };
  const s = getStoredBooks();
  s.localBooks.push(book);
  const r = saveStoredBooks(s);
  if (!r.ok) {
    if (r.quota)
      return {
        ok: false,
        quota: true,
        error:
          "Brak miejsca na zapisanie książki na tym urządzeniu. Usuń większą okładkę albo wybierz mniejszy plik.",
      };
    return { ok: false, error: "Nie udało się zapisać książki." };
  }
  return { ok: true, book };
}

export function updateBook(
  bookId: string,
  updates: Partial<Book> & { publisher?: string; seriesName?: string; seriesPart?: string },
): { ok: boolean; quota?: boolean; error?: string } {
  const s = getStoredBooks();
  const localIdx = s.localBooks.findIndex((b) => b.id === bookId);
  const cleaned: Record<string, unknown> = { ...updates };
  (cleaned as { updatedAt?: string }).updatedAt = nowIso();
  if (localIdx >= 0) {
    s.localBooks[localIdx] = { ...s.localBooks[localIdx], ...(cleaned as Partial<Book>) } as Book;
  } else {
    s.overrides[bookId] = { ...(s.overrides[bookId] || {}), ...(cleaned as Partial<Book>) };
  }
  const r = saveStoredBooks(s);
  if (!r.ok) {
    if (r.quota)
      return {
        ok: false,
        quota: true,
        error:
          "Brak miejsca na zapisanie książki na tym urządzeniu. Usuń większą okładkę albo wybierz mniejszy plik.",
      };
    return { ok: false, error: "Nie udało się zapisać zmian." };
  }
  return { ok: true };
}

export function deleteBook(bookId: string): { ok: boolean } {
  const s = getStoredBooks();
  const wasLocal = s.localBooks.some((b) => b.id === bookId);
  if (wasLocal) {
    s.localBooks = s.localBooks.filter((b) => b.id !== bookId);
  } else {
    if (!s.deletedIds.includes(bookId)) s.deletedIds.push(bookId);
  }
  const r = saveStoredBooks(s);
  return { ok: r.ok };
}

function subscribe(l: Listener) {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
}

export function useBooksVersion(): number {
  return useSyncExternalStore(
    subscribe,
    () => version,
    () => 0,
  );
}

// ---------- Image compression (cover upload) ----------
export interface CompressResult {
  dataUrl: string;
  bytes: number;
}

export async function compressCoverFile(
  file: File,
  maxEdge = 1200,
  quality = 0.82,
): Promise<CompressResult> {
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(typeof r.result === "string" ? r.result : "");
    r.onerror = () => reject(new Error("read-failed"));
    r.readAsDataURL(file);
  });
  if (!dataUrl) throw new Error("read-failed");
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const i = new Image();
    i.onload = () => resolve(i);
    i.onerror = () => reject(new Error("img-failed"));
    i.src = dataUrl;
  });
  const longEdge = Math.max(img.width, img.height);
  const scale = longEdge > maxEdge ? maxEdge / longEdge : 1;
  const w = Math.max(1, Math.round(img.width * scale));
  const h = Math.max(1, Math.round(img.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("ctx-failed");
  ctx.drawImage(img, 0, 0, w, h);
  const mime = file.type === "image/png" && longEdge <= 800 ? "image/png" : "image/jpeg";
  const out = canvas.toDataURL(mime, quality);
  return { dataUrl: out, bytes: out.length };
}
