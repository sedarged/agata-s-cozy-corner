// User preferences for new-item defaults, persisted to localStorage.
// Kept separate from the data stores: these are lightweight UI defaults, not
// content. Read on demand (e.g. when creating a book / opening the note editor).
import type { BookStatus, NoteInputMode } from "./mock-data";

const KEY = "agata-preferences-v1";

interface Prefs {
  defaultBookStatus?: BookStatus;
  defaultNoteMode?: NoteInputMode;
}

function read(): Prefs {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as Prefs) : {};
  } catch {
    return {};
  }
}

function write(patch: Partial<Prefs>) {
  if (typeof window === "undefined") return;
  try {
    const merged = { ...read(), ...patch };
    window.localStorage.setItem(KEY, JSON.stringify(merged));
  } catch {
    /* ignore quota — preferences are non-critical */
  }
}

export const DEFAULT_BOOK_STATUS: BookStatus = "queue";
export const DEFAULT_NOTE_MODE: NoteInputMode = "handwriting";

export function getDefaultBookStatus(): BookStatus {
  return read().defaultBookStatus ?? DEFAULT_BOOK_STATUS;
}
export function setDefaultBookStatus(status: BookStatus) {
  write({ defaultBookStatus: status });
}

export function getDefaultNoteMode(): NoteInputMode {
  return read().defaultNoteMode ?? DEFAULT_NOTE_MODE;
}
export function setDefaultNoteMode(mode: NoteInputMode) {
  write({ defaultNoteMode: mode });
}
