import { useSyncExternalStore } from "react";
import {
  notes as mockNotes,
  type Note,
  type NoteType,
  simpleType,
  type SimpleNoteType,
} from "./mock-data";
import { emitQuotaEvent } from "./backup";
import { genId, localDay } from "./utils";

export const NOTES_STORAGE_KEY = "agata-book-notes-v1";
export const NOTES_DELETED_KEY = "agata-book-notes-deleted-v1";

type Listener = () => void;
const listeners = new Set<Listener>();
let version = 0;
// Hydration guard (mirrors books-store): hide localStorage-backed notes until
// the first client subscription so SSR and first client render match.
let mounted = false;

const isClient = () => typeof window !== "undefined";

function safeRead(): Note[] {
  if (!isClient()) return [];
  try {
    const raw = window.localStorage.getItem(NOTES_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as Note[]) : [];
  } catch {
    return [];
  }
}

function safeWrite(arr: Note[]): { ok: boolean; quota?: boolean } {
  if (!isClient()) return { ok: false };
  try {
    window.localStorage.setItem(NOTES_STORAGE_KEY, JSON.stringify(arr));
    version++;
    listeners.forEach((l) => l());
    return { ok: true };
  } catch (e) {
    const quota = e instanceof Error && /quota|exceeded/i.test(e.message);
    if (quota) emitQuotaEvent("notes");
    return { ok: false, quota };
  }
}

function readDeleted(): string[] {
  if (!isClient()) return [];
  try {
    const raw = window.localStorage.getItem(NOTES_DELETED_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as string[]) : [];
  } catch {
    return [];
  }
}

function writeDeleted(ids: string[]) {
  if (!isClient()) return;
  try {
    window.localStorage.setItem(NOTES_DELETED_KEY, JSON.stringify(ids));
    version++;
    listeners.forEach((l) => l());
  } catch {
    /* noop */
  }
}

export function getStoredNotes(): Note[] {
  return safeRead();
}

export function saveStoredNotes(arr: Note[]) {
  return safeWrite(arr);
}

export function getAllNotes(): Note[] {
  // Until mounted (SSR + first client render) show mock-only so markup matches.
  if (!mounted) return mockNotes;
  const stored = safeRead();
  const deleted = new Set(readDeleted());
  const overrideIds = new Set(stored.map((n) => n.id));
  return [
    ...mockNotes.filter((n) => !overrideIds.has(n.id) && !deleted.has(n.id)),
    ...stored.filter((n) => !deleted.has(n.id)),
  ];
}

export function getNotesForBook(bookId: string): Note[] {
  return getAllNotes().filter((n) => n.bookId === bookId);
}

export function getNoteById(noteId: string): Note | undefined {
  return getAllNotes().find((n) => n.id === noteId);
}

export function getNotesForBookByType(bookId: string, t: SimpleNoteType): Note[] {
  return getNotesForBook(bookId).filter((n) => simpleType(n.type) === t);
}

// Local-timezone day (YYYY-MM-DD) so a note shows the calendar day it was made in.
const today = () => localDay();
const nowIso = () => new Date().toISOString();

export interface NewNoteInput {
  bookId: string;
  type: NoteType;
  title?: string;
  content?: string;
  quoteText?: string;
  pageNumber?: number;
  chapterNumber?: number;
  chapterTitle?: string;
  photoUrl?: string;
  inputMode?: Note["inputMode"];
  drawingDataUrl?: string;
  drawingBackground?: Note["drawingBackground"];
  tags?: string[];
}

export function createNote(input: NewNoteInput): { ok: boolean; quota?: boolean; note?: Note } {
  const stored = safeRead();
  const note: Note = {
    id: genId("note"),
    bookId: input.bookId,
    type: input.type,
    title: input.title,
    content: input.content ?? "",
    quoteText: input.quoteText,
    pageNumber: input.pageNumber,
    chapterNumber: input.chapterNumber,
    chapterTitle: input.chapterTitle,
    photoUrl: input.photoUrl,
    inputMode: input.inputMode,
    drawingDataUrl: input.drawingDataUrl,
    drawingBackground: input.drawingBackground,
    isFavourite: false,
    tags: input.tags ?? [],
    createdAt: today(),
    updatedAt: nowIso(),
  };
  const res = safeWrite([...stored, note]);
  return { ok: res.ok, quota: res.quota, note: res.ok ? note : undefined };
}

export function updateNote(
  noteId: string,
  updates: Partial<Note>,
): { ok: boolean; quota?: boolean; note?: Note } {
  const stored = safeRead();
  const mock = mockNotes.find((n) => n.id === noteId);
  const existing = stored.find((n) => n.id === noteId) ?? mock;
  if (!existing) return { ok: false };
  const merged: Note = {
    ...existing,
    ...updates,
    id: existing.id,
    bookId: existing.bookId,
    createdAt: existing.createdAt,
    updatedAt: nowIso(),
  };
  const next = stored.some((n) => n.id === noteId)
    ? stored.map((n) => (n.id === noteId ? merged : n))
    : [...stored, merged];
  const res = safeWrite(next);
  return { ok: res.ok, quota: res.quota, note: res.ok ? merged : undefined };
}

export function deleteNote(noteId: string): boolean {
  const stored = safeRead();
  const inStored = stored.some((n) => n.id === noteId);
  const inMock = mockNotes.some((n) => n.id === noteId);
  if (inStored) {
    const res = safeWrite(stored.filter((n) => n.id !== noteId));
    if (!res.ok) return false;
  }
  if (inMock) {
    const deleted = readDeleted();
    if (!deleted.includes(noteId)) writeDeleted([...deleted, noteId]);
  }
  return inStored || inMock;
}

function subscribe(l: Listener) {
  listeners.add(l);
  if (!mounted) {
    mounted = true;
    queueMicrotask(() => {
      version++;
      listeners.forEach((fn) => fn());
    });
  }
  return () => {
    listeners.delete(l);
  };
}

export function useNotesVersion(): number {
  return useSyncExternalStore(
    subscribe,
    () => version,
    () => 0,
  );
}
