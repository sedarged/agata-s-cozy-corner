import { useSyncExternalStore } from "react";
import {
  notes as mockNotes,
  type Note,
  type NoteType,
  simpleType,
  type SimpleNoteType,
} from "./mock-data";

export const NOTES_STORAGE_KEY = "agata-book-notes-v1";

type Listener = () => void;
const listeners = new Set<Listener>();
let version = 0;

function safeRead(): Note[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(NOTES_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as Note[]) : [];
  } catch {
    return [];
  }
}

function safeWrite(arr: Note[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(NOTES_STORAGE_KEY, JSON.stringify(arr));
  } catch {
    /* quota or disabled — ignore */
  }
  version++;
  listeners.forEach(l => l());
}

export function getStoredNotes(): Note[] {
  return safeRead();
}

export function saveStoredNotes(arr: Note[]) {
  safeWrite(arr);
}

export function getAllNotes(): Note[] {
  const stored = safeRead();
  const overrideIds = new Set(stored.map(n => n.id));
  return [...mockNotes.filter(n => !overrideIds.has(n.id)), ...stored];
}

export function getNotesForBook(bookId: string): Note[] {
  return getAllNotes().filter(n => n.bookId === bookId);
}

export function getNoteById(noteId: string): Note | undefined {
  return getAllNotes().find(n => n.id === noteId);
}

export function getNotesForBookByType(bookId: string, t: SimpleNoteType): Note[] {
  return getNotesForBook(bookId).filter(n => simpleType(n.type) === t);
}

const today = () => new Date().toISOString().slice(0, 10);
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
}

export function createNote(input: NewNoteInput): Note {
  const stored = safeRead();
  const note: Note = {
    id: `note-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
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
    tags: [],
    createdAt: today(),
    updatedAt: nowIso(),
  };
  safeWrite([...stored, note]);
  return note;
}

export function updateNote(noteId: string, updates: Partial<Note>): Note | null {
  const stored = safeRead();
  const mock = mockNotes.find(n => n.id === noteId);
  const existing = stored.find(n => n.id === noteId) ?? mock;
  if (!existing) return null;
  const merged: Note = {
    ...existing,
    ...updates,
    id: existing.id,
    bookId: existing.bookId,
    createdAt: existing.createdAt,
    updatedAt: nowIso(),
  };
  const next = stored.some(n => n.id === noteId)
    ? stored.map(n => (n.id === noteId ? merged : n))
    : [...stored, merged];
  safeWrite(next);
  return merged;
}

function subscribe(l: Listener) {
  listeners.add(l);
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
