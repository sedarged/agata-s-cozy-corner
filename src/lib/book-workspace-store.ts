import { useSyncExternalStore } from "react";
import { sessions as mockSessions, type ReadingSession, getBookById } from "./mock-data";

export const BOOK_STATE_KEY = "agata-book-state-v1";
export const READING_SESSIONS_KEY = "agata-reading-sessions-v1";
export const NOTE_DRAFT_PREFIX = "agata-note-draft-";

export interface BookUserState {
  bookId: string;
  status?: string;
  currentPage?: number;
  rating?: number;
  favourite?: boolean;
  opinion?: string;
  startedAt?: string;
  finishedAt?: string;
  updatedAt: string;
}

export interface StoredReadingSession {
  id: string;
  bookId: string;
  date: string;
  minutes: number;
  pagesRead: number;
  startPage: number;
  endPage: number;
  createdAt: string;
  updatedAt: string;
}

type Listener = () => void;
const listeners = new Set<Listener>();
let version = 0;
const bump = () => { version++; listeners.forEach(l => l()); };

const isClient = () => typeof window !== "undefined";
const nowIso = () => new Date().toISOString();
const today = () => new Date().toISOString().slice(0, 10);

function readJson<T>(key: string, fallback: T): T {
  if (!isClient()) return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return fallback;
    const v = JSON.parse(raw);
    return (v ?? fallback) as T;
  } catch {
    return fallback;
  }
}

function writeJson(key: string, val: unknown): { ok: boolean; quota?: boolean } {
  if (!isClient()) return { ok: false };
  try {
    window.localStorage.setItem(key, JSON.stringify(val));
    bump();
    return { ok: true };
  } catch (e) {
    const quota = e instanceof Error && /quota|exceeded/i.test(e.message);
    return { ok: false, quota };
  }
}

// ---------- Book state ----------

type BookStateMap = Record<string, BookUserState>;

export function getAllBookState(): BookStateMap {
  return readJson<BookStateMap>(BOOK_STATE_KEY, {});
}

export function getBookState(bookId: string): BookUserState | undefined {
  return getAllBookState()[bookId];
}

export function updateBookState(bookId: string, patch: Partial<BookUserState>): BookUserState {
  const all = getAllBookState();
  const prev = all[bookId] ?? { bookId, updatedAt: nowIso() };
  const next: BookUserState = { ...prev, ...patch, bookId, updatedAt: nowIso() };
  all[bookId] = next;
  writeJson(BOOK_STATE_KEY, all);
  return next;
}

/** Merge mock book defaults with saved local overrides for read paths. */
export function getEffectiveBook(bookId: string) {
  const book = getBookById(bookId);
  if (!book) return undefined;
  const s = getBookState(bookId);
  if (!s) return book;
  return {
    ...book,
    status: (s.status as typeof book.status) ?? book.status,
    currentPage: s.currentPage ?? book.currentPage,
    rating: s.rating ?? book.rating,
    isFavourite: s.favourite ?? book.isFavourite,
  };
}

// ---------- Reading sessions ----------

export function getStoredSessions(): StoredReadingSession[] {
  return readJson<StoredReadingSession[]>(READING_SESSIONS_KEY, []);
}

export function getSessionsForBook(bookId: string): StoredReadingSession[] {
  return getStoredSessions().filter(s => s.bookId === bookId);
}

export interface NewSessionInput {
  bookId: string;
  minutes: number;
  pagesRead: number;
  startPage: number;
  endPage: number;
}

export function createReadingSession(input: NewSessionInput): { ok: boolean; quota?: boolean; session?: StoredReadingSession } {
  const list = getStoredSessions();
  const session: StoredReadingSession = {
    id: `rs-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    bookId: input.bookId,
    date: today(),
    minutes: Math.max(0, Math.round(input.minutes)),
    pagesRead: Math.max(0, input.pagesRead),
    startPage: input.startPage,
    endPage: input.endPage,
    createdAt: nowIso(),
    updatedAt: nowIso(),
  };
  const res = writeJson(READING_SESSIONS_KEY, [...list, session]);
  return { ok: res.ok, quota: res.quota, session: res.ok ? session : undefined };
}

/** Merge mock sessions with locally saved sessions, normalising shape. */
export function getCombinedSessionsForBook(bookId: string): StoredReadingSession[] {
  const local = getSessionsForBook(bookId);
  const mock: StoredReadingSession[] = mockSessions
    .filter(s => s.bookId === bookId)
    .map((s: ReadingSession) => ({
      id: s.id,
      bookId: s.bookId,
      date: s.date,
      minutes: s.durationMinutes,
      pagesRead: Math.max(0, s.endPage - s.startPage),
      startPage: s.startPage,
      endPage: s.endPage,
      createdAt: s.date,
      updatedAt: s.date,
    }));
  return [...mock, ...local];
}

// ---------- Note drafts ----------

export interface NoteDraft {
  type?: string;
  inputMode?: string;
  title?: string;
  content?: string;
  quoteText?: string;
  chapter?: string;
  pageNumber?: string;
  photoUrl?: string;
  drawingDataUrl?: string;
  drawingBackground?: string;
  savedAt: string;
}

export function getNoteDraft(bookId: string): NoteDraft | null {
  return readJson<NoteDraft | null>(NOTE_DRAFT_PREFIX + bookId, null);
}

export function setNoteDraft(bookId: string, draft: NoteDraft): { ok: boolean; quota?: boolean } {
  return writeJson(NOTE_DRAFT_PREFIX + bookId, draft);
}

export function clearNoteDraft(bookId: string) {
  if (!isClient()) return;
  try { window.localStorage.removeItem(NOTE_DRAFT_PREFIX + bookId); bump(); } catch { /* noop */ }
}

// ---------- Reactivity hook ----------

function subscribe(l: Listener) {
  listeners.add(l);
  return () => { listeners.delete(l); };
}

export function useWorkspaceVersion(): number {
  return useSyncExternalStore(subscribe, () => version, () => 0);
}

// ---------- Image compression helper ----------

export interface CompressResult {
  dataUrl: string;
  bytes: number;
}

/** Resize/compress an image File to JPEG (or PNG if transparency required). */
export async function compressImageFile(file: File, maxEdge = 1400, quality = 0.82): Promise<CompressResult> {
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

  // Use JPEG by default for size; PNG only if original was PNG and small.
  const mime = file.type === "image/png" && longEdge <= 800 ? "image/png" : "image/jpeg";
  const out = canvas.toDataURL(mime, quality);
  return { dataUrl: out, bytes: out.length };
}
