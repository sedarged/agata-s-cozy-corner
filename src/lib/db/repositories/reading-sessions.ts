// Agata — reading sessions repository. CRUD over the `reading_sessions` table.
import { and, desc, eq, gte, lte } from "drizzle-orm";
import { getDb } from "../client";
import { readingSessions } from "../schema";
import type { ReadingSessionRow, ReadingSessionInsert } from "../types";

const nowIso = () => new Date().toISOString();

export async function listSessions(): Promise<ReadingSessionRow[]> {
  return getDb()
    .select()
    .from(readingSessions)
    .orderBy(desc(readingSessions.date))
    .all() as ReadingSessionRow[];
}

export async function listSessionsForBook(bookId: string): Promise<ReadingSessionRow[]> {
  return getDb()
    .select()
    .from(readingSessions)
    .where(eq(readingSessions.bookId, bookId))
    .orderBy(desc(readingSessions.date))
    .all() as ReadingSessionRow[];
}

export async function listSessionsBetween(
  startISO: string,
  endISO: string,
): Promise<ReadingSessionRow[]> {
  return getDb()
    .select()
    .from(readingSessions)
    .where(and(gte(readingSessions.date, startISO), lte(readingSessions.date, endISO)))
    .orderBy(desc(readingSessions.date))
    .all() as ReadingSessionRow[];
}

export interface SessionInput {
  id?: string;
  bookId: string;
  date: string; // YYYY-MM-DD
  minutes: number;
  pagesRead: number;
  startPage: number;
  endPage: number;
}

export async function createSession(
  input: SessionInput & { id: string },
): Promise<ReadingSessionRow> {
  const now = nowIso();
  const row: ReadingSessionInsert = {
    id: input.id,
    bookId: input.bookId,
    date: input.date,
    minutes: Math.max(0, Math.round(input.minutes)),
    pagesRead: Math.max(0, input.pagesRead),
    startPage: input.startPage,
    endPage: input.endPage,
    createdAt: now,
    updatedAt: now,
  };
  getDb().insert(readingSessions).values(row).run();
  return (await getSession(input.id))!;
}

export async function getSession(id: string): Promise<ReadingSessionRow | undefined> {
  return getDb().select().from(readingSessions).where(eq(readingSessions.id, id)).get() as
    | ReadingSessionRow
    | undefined;
}

export async function patchSession(
  id: string,
  patch: Partial<SessionInput>,
): Promise<ReadingSessionRow | undefined> {
  const existing = await getSession(id);
  if (!existing) return undefined;
  const next: ReadingSessionRow = {
    ...existing,
    ...patch,
    id: existing.id,
    bookId: existing.bookId,
    minutes:
      patch.minutes !== undefined ? Math.max(0, Math.round(patch.minutes)) : existing.minutes,
    pagesRead:
      patch.pagesRead !== undefined
        ? Math.max(0, Math.round(patch.pagesRead))
        : Math.max(
            0,
            (patch.endPage ?? existing.endPage) - (patch.startPage ?? existing.startPage),
          ),
    updatedAt: nowIso(),
  };
  getDb().update(readingSessions).set(next).where(eq(readingSessions.id, id)).run();
  return getSession(id);
}

export async function deleteSession(id: string): Promise<boolean> {
  const res = getDb().delete(readingSessions).where(eq(readingSessions.id, id)).run();
  return res.changes > 0;
}
