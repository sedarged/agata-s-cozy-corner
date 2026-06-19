import { useSyncExternalStore } from "react";
import { sessions as mockSessions, type ReadingSession, getBookById } from "./mock-data";
import { getEffectiveBookById, updateBook } from "./books-store";
import { emitQuotaEvent } from "./backup";

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
// Hydration guard: see books-store.ts for rationale.
let mounted = false;
const bump = () => {
  version++;
  listeners.forEach((l) => l());
};

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
    if (quota) {
      const source =
        key === READING_SESSIONS_KEY
          ? "sessions"
          : key.startsWith(NOTE_DRAFT_PREFIX)
            ? "draft"
            : "other";
      emitQuotaEvent(source);
    }
    return { ok: false, quota };
  }
}

// ---------- Book state ----------

type BookStateMap = Record<string, BookUserState>;

export function getAllBookState(): BookStateMap {
  if (!mounted) return {};
  return readJson<BookStateMap>(BOOK_STATE_KEY, {});
}

export function getBookState(bookId: string): BookUserState | undefined {
  return getAllBookState()[bookId];
}

function mirrorBookStateToBooksStore(bookId: string, state: BookUserState) {
  const updates: Record<string, unknown> = {};
  if (state.status !== undefined) updates.status = state.status;
  if (state.currentPage !== undefined) updates.currentPage = state.currentPage;
  if (state.rating !== undefined) updates.rating = state.rating;
  if (state.favourite !== undefined) updates.isFavourite = state.favourite;
  if (state.opinion !== undefined) updates.opinion = state.opinion;
  if (state.startedAt !== undefined) updates.startedAt = state.startedAt;
  if (state.finishedAt !== undefined) updates.finishedAt = state.finishedAt;
  if (Object.keys(updates).length > 0)
    updateBook(bookId, updates as Parameters<typeof updateBook>[1]);
}

export function updateBookState(bookId: string, patch: Partial<BookUserState>): BookUserState {
  const all = getAllBookState();
  const prev = all[bookId] ?? { bookId, updatedAt: nowIso() };
  const next: BookUserState = { ...prev, ...patch, bookId, updatedAt: nowIso() };
  if (patch.status === "reading" && !prev.startedAt && !next.startedAt) next.startedAt = nowIso();
  if (patch.status === "finished" && !prev.finishedAt && !next.finishedAt)
    next.finishedAt = nowIso();
  all[bookId] = next;
  writeJson(BOOK_STATE_KEY, all);
  mirrorBookStateToBooksStore(bookId, next);
  return next;
}

export interface EffectiveBook {
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
  status: ReturnType<typeof getBookById> extends infer B
    ? B extends { status: infer S }
      ? S
      : never
    : never;
  rating?: number;
  isFavourite: boolean;
  tags: string[];
  opinion?: string;
  startedAt?: string;
  finishedAt?: string;
}

/** Merge book defaults with saved local workspace state for read paths. */
export function getEffectiveBook(bookId: string): EffectiveBook | undefined {
  const book = getEffectiveBookById(bookId);
  if (!book) return undefined;
  const s = getBookState(bookId);
  return {
    ...book,
    status: (s?.status as typeof book.status) ?? book.status,
    currentPage: s?.currentPage ?? book.currentPage,
    rating: s?.rating ?? book.rating,
    isFavourite: s?.favourite ?? book.isFavourite,
    opinion: s?.opinion ?? (book as { opinion?: string }).opinion,
    startedAt: s?.startedAt ?? (book as { startedAt?: string }).startedAt,
    finishedAt: s?.finishedAt ?? (book as { finishedAt?: string }).finishedAt,
  };
}

// ---------- Reading sessions ----------

export function getStoredSessions(): StoredReadingSession[] {
  if (!mounted) return [];
  return readJson<StoredReadingSession[]>(READING_SESSIONS_KEY, []);
}

export function getSessionsForBook(bookId: string): StoredReadingSession[] {
  return getStoredSessions().filter((s) => s.bookId === bookId);
}

export interface NewSessionInput {
  bookId: string;
  minutes: number;
  pagesRead: number;
  startPage: number;
  endPage: number;
}

export function createReadingSession(input: NewSessionInput): {
  ok: boolean;
  quota?: boolean;
  session?: StoredReadingSession;
} {
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

export function updateReadingSession(
  id: string,
  patch: Partial<
    Pick<StoredReadingSession, "minutes" | "pagesRead" | "startPage" | "endPage" | "date">
  >,
): { ok: boolean; quota?: boolean } {
  const list = getStoredSessions();
  const idx = list.findIndex((s) => s.id === id);
  if (idx < 0) return { ok: false };
  const next: StoredReadingSession = {
    ...list[idx],
    ...patch,
    pagesRead:
      patch.pagesRead !== undefined
        ? Math.max(0, Math.round(patch.pagesRead))
        : Math.max(
            0,
            (patch.endPage ?? list[idx].endPage) - (patch.startPage ?? list[idx].startPage),
          ),
    minutes:
      patch.minutes !== undefined ? Math.max(0, Math.round(patch.minutes)) : list[idx].minutes,
    updatedAt: nowIso(),
  };
  list[idx] = next;
  return writeJson(READING_SESSIONS_KEY, list);
}

export function deleteReadingSession(id: string): { ok: boolean } {
  const list = getStoredSessions();
  const next = list.filter((s) => s.id !== id);
  if (next.length === list.length) return { ok: false };
  const r = writeJson(READING_SESSIONS_KEY, next);
  return { ok: r.ok };
}

export interface CombinedSession extends StoredReadingSession {
  isLocal: boolean;
}

/** Merge mock sessions with locally saved sessions, normalising shape. */
export function getCombinedSessionsForBook(bookId: string): CombinedSession[] {
  const local: CombinedSession[] = getSessionsForBook(bookId).map((s) => ({ ...s, isLocal: true }));
  const mock: CombinedSession[] = mockSessions
    .filter((s) => s.bookId === bookId)
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
      isLocal: false,
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
  try {
    window.localStorage.removeItem(NOTE_DRAFT_PREFIX + bookId);
    bump();
  } catch {
    /* noop */
  }
}

// ---------- Reactivity hook ----------

function subscribe(l: Listener) {
  listeners.add(l);
  if (!mounted) {
    mounted = true;
    queueMicrotask(bump);
  }
  return () => {
    listeners.delete(l);
  };
}

export function useWorkspaceVersion(): number {
  return useSyncExternalStore(
    subscribe,
    () => version,
    () => 0,
  );
}

// ---------- Image compression helper ----------

export interface CompressResult {
  dataUrl: string;
  bytes: number;
}

/** Resize/compress an image File to JPEG (or PNG if transparency required). */
export async function compressImageFile(
  file: File,
  maxEdge = 1400,
  quality = 0.82,
): Promise<CompressResult> {
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(typeof r.result === "string" ? r.result : "");
    r.onerror = () => reject(r.error);
    r.readAsDataURL(file);
  });

  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const i = new Image();
    i.onload = () => resolve(i);
    i.onerror = () => reject(new Error("image-load"));
    i.src = dataUrl;
  });

  const scale = Math.min(1, maxEdge / Math.max(img.width, img.height));
  const w = Math.max(1, Math.round(img.width * scale));
  const h = Math.max(1, Math.round(img.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("canvas");
  ctx.drawImage(img, 0, 0, w, h);
  const out = canvas.toDataURL("image/jpeg", quality);
  return { dataUrl: out, bytes: Math.round((out.length * 3) / 4) };
}
