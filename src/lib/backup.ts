// Agata — local data backup, import, migrations, quota events.
// Phase A: stability & data safety.

import { BOOKS_KEY } from "./books-store";
import { BOOK_STATE_KEY, READING_SESSIONS_KEY, NOTE_DRAFT_PREFIX } from "./book-workspace-store";
import { NOTES_STORAGE_KEY, NOTES_DELETED_KEY } from "./notes-store";
import { GOALS_KEY } from "./goals-store";

export const SCHEMA_VERSION_KEY = "agata-schema-v";
export const CURRENT_SCHEMA_VERSION = 1;

const isClient = () => typeof window !== "undefined";

// ---------- Quota event bus ----------

export type QuotaSource = "books" | "notes" | "sessions" | "draft" | "import" | "other";

export function emitQuotaEvent(source: QuotaSource, message?: string) {
  if (!isClient()) return;
  try {
    window.dispatchEvent(
      new CustomEvent("agata:quota", { detail: { source, message } }),
    );
  } catch {
    /* noop */
  }
}

// ---------- Export / Import ----------

export interface AgataBackup {
  app: "agata";
  schemaVersion: number;
  exportedAt: string;
  data: {
    books?: unknown;
    bookState?: unknown;
    readingSessions?: unknown;
    notes?: unknown;
    notesDeleted?: unknown;
    goals?: unknown;
    noteDrafts?: Record<string, unknown>;
  };
}

function readRaw(key: string): unknown {
  if (!isClient()) return undefined;
  const raw = window.localStorage.getItem(key);
  if (raw == null) return undefined;
  try {
    return JSON.parse(raw);
  } catch {
    return undefined;
  }
}

export function buildBackup(): AgataBackup {
  const noteDrafts: Record<string, unknown> = {};
  if (isClient()) {
    for (let i = 0; i < window.localStorage.length; i++) {
      const k = window.localStorage.key(i);
      if (k && k.startsWith(NOTE_DRAFT_PREFIX)) {
        const v = readRaw(k);
        if (v !== undefined) noteDrafts[k] = v;
      }
    }
  }
  return {
    app: "agata",
    schemaVersion: CURRENT_SCHEMA_VERSION,
    exportedAt: new Date().toISOString(),
    data: {
      books: readRaw(BOOKS_KEY),
      bookState: readRaw(BOOK_STATE_KEY),
      readingSessions: readRaw(READING_SESSIONS_KEY),
      notes: readRaw(NOTES_STORAGE_KEY),
      notesDeleted: readRaw(NOTES_DELETED_KEY),
      goals: readRaw(GOALS_KEY),
      noteDrafts,
    },
  };
}

export function downloadBackup() {
  if (!isClient()) return;
  const payload = buildBackup();
  const blob = new Blob([JSON.stringify(payload, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
  a.href = url;
  a.download = `agata-kopia-${stamp}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export type ImportMode = "merge" | "replace";

function writeIfPresent(key: string, value: unknown): boolean {
  if (value === undefined) return true;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch (e) {
    const quota = e instanceof Error && /quota|exceeded/i.test(e.message);
    if (quota) emitQuotaEvent("import", "Brak miejsca przy imporcie kopii.");
    return false;
  }
}

function mergeArray<T extends { id?: string }>(a: T[], b: T[]): T[] {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const x of [...a, ...b]) {
    const id = x?.id;
    if (id && seen.has(id)) continue;
    if (id) seen.add(id);
    out.push(x);
  }
  return out;
}

function mergeObject(a: Record<string, unknown>, b: Record<string, unknown>) {
  return { ...a, ...b };
}

export interface ImportResult {
  ok: boolean;
  error?: string;
  quota?: boolean;
}

export function importBackup(json: unknown, mode: ImportMode): ImportResult {
  if (!isClient()) return { ok: false, error: "Brak przeglądarki." };
  if (!json || typeof json !== "object") return { ok: false, error: "Niepoprawny plik kopii." };
  const b = json as Partial<AgataBackup>;
  if (b.app !== "agata" || !b.data) return { ok: false, error: "To nie jest kopia Agaty." };

  let allOk = true;

  // books: { localBooks, overrides, deletedIds }
  const incomingBooks = b.data.books as
    | { localBooks?: unknown[]; overrides?: Record<string, unknown>; deletedIds?: unknown[] }
    | undefined;
  if (incomingBooks) {
    if (mode === "replace") {
      allOk = writeIfPresent(BOOKS_KEY, incomingBooks) && allOk;
    } else {
      const cur = (readRaw(BOOKS_KEY) as typeof incomingBooks) || {};
      const merged = {
        localBooks: mergeArray(
          (cur.localBooks as { id?: string }[]) || [],
          (incomingBooks.localBooks as { id?: string }[]) || [],
        ),
        overrides: mergeObject(
          (cur.overrides as Record<string, unknown>) || {},
          (incomingBooks.overrides as Record<string, unknown>) || {},
        ),
        deletedIds: Array.from(
          new Set([
            ...((cur.deletedIds as string[]) || []),
            ...((incomingBooks.deletedIds as string[]) || []),
          ]),
        ),
      };
      allOk = writeIfPresent(BOOKS_KEY, merged) && allOk;
    }
  }

  // bookState: map
  if (b.data.bookState !== undefined) {
    if (mode === "replace") {
      allOk = writeIfPresent(BOOK_STATE_KEY, b.data.bookState) && allOk;
    } else {
      const cur = (readRaw(BOOK_STATE_KEY) as Record<string, unknown>) || {};
      allOk =
        writeIfPresent(BOOK_STATE_KEY, mergeObject(cur, b.data.bookState as Record<string, unknown>)) &&
        allOk;
    }
  }

  // reading sessions: array
  if (Array.isArray(b.data.readingSessions)) {
    if (mode === "replace") {
      allOk = writeIfPresent(READING_SESSIONS_KEY, b.data.readingSessions) && allOk;
    } else {
      const cur = (readRaw(READING_SESSIONS_KEY) as { id?: string }[]) || [];
      allOk =
        writeIfPresent(
          READING_SESSIONS_KEY,
          mergeArray(cur, b.data.readingSessions as { id?: string }[]),
        ) && allOk;
    }
  }

  // notes: array
  if (Array.isArray(b.data.notes)) {
    if (mode === "replace") {
      allOk = writeIfPresent(NOTES_STORAGE_KEY, b.data.notes) && allOk;
    } else {
      const cur = (readRaw(NOTES_STORAGE_KEY) as { id?: string }[]) || [];
      allOk =
        writeIfPresent(NOTES_STORAGE_KEY, mergeArray(cur, b.data.notes as { id?: string }[])) &&
        allOk;
    }
  }

  // deleted note ids
  if (Array.isArray(b.data.notesDeleted)) {
    if (mode === "replace") {
      allOk = writeIfPresent(NOTES_DELETED_KEY, b.data.notesDeleted) && allOk;
    } else {
      const cur = (readRaw(NOTES_DELETED_KEY) as string[]) || [];
      allOk =
        writeIfPresent(
          NOTES_DELETED_KEY,
          Array.from(new Set([...cur, ...(b.data.notesDeleted as string[])])),
        ) && allOk;
    }
  }

  // drafts
  if (b.data.noteDrafts && typeof b.data.noteDrafts === "object") {
    for (const [k, v] of Object.entries(b.data.noteDrafts)) {
      if (!k.startsWith(NOTE_DRAFT_PREFIX)) continue;
      if (mode === "replace") {
        allOk = writeIfPresent(k, v) && allOk;
      } else {
        if (!window.localStorage.getItem(k)) allOk = writeIfPresent(k, v) && allOk;
      }
    }
  }

  if (!allOk) return { ok: false, quota: true, error: "Brak miejsca na zapis kopii." };
  // bump all stores so UI re-renders
  window.dispatchEvent(new CustomEvent("agata:imported"));
  return { ok: true };
}

// ---------- Migrations ----------

interface Migration {
  to: number;
  run: () => void;
}

const MIGRATIONS: Migration[] = [
  // v1: baseline — no-op. Future migrations append here.
  { to: 1, run: () => {} },
];

export function runMigrations() {
  if (!isClient()) return;
  let current = 0;
  try {
    const raw = window.localStorage.getItem(SCHEMA_VERSION_KEY);
    current = raw ? parseInt(raw, 10) || 0 : 0;
  } catch {
    current = 0;
  }
  for (const m of MIGRATIONS) {
    if (current < m.to) {
      try {
        m.run();
        current = m.to;
        window.localStorage.setItem(SCHEMA_VERSION_KEY, String(current));
      } catch (e) {
        console.error("[agata] migration failed", m.to, e);
        break;
      }
    }
  }
}

// ---------- Storage size estimate ----------

export function estimateStorageBytes(): number {
  if (!isClient()) return 0;
  let total = 0;
  try {
    for (let i = 0; i < window.localStorage.length; i++) {
      const k = window.localStorage.key(i);
      if (!k || !k.startsWith("agata-")) continue;
      const v = window.localStorage.getItem(k) || "";
      total += k.length + v.length;
    }
  } catch {
    /* noop */
  }
  return total * 2; // UTF-16 chars
}

export function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(2)} MB`;
}
