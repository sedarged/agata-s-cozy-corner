import { getStoredSessions } from "./book-workspace-store";
import { getAllEffectiveBooks } from "./effective-books";
import { getAllNotes } from "./notes-store";

/** All session-based stats use ONLY locally stored sessions (real user data). */

export interface DayBucket {
  date: string; // ISO YYYY-MM-DD
  minutes: number;
  pages: number;
}

const isoDay = (d: Date) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};

export function getLastNDays(n: number): DayBucket[] {
  const sessions = getStoredSessions();
  const buckets = new Map<string, DayBucket>();
  const today = new Date();
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    const key = isoDay(d);
    buckets.set(key, { date: key, minutes: 0, pages: 0 });
  }
  for (const s of sessions) {
    const b = buckets.get(s.date);
    if (b) {
      b.minutes += s.minutes;
      b.pages += s.pagesRead;
    }
  }
  return [...buckets.values()];
}

export function getCurrentWeekMinutes(): number {
  return getLastNDays(7).reduce((a, b) => a + b.minutes, 0);
}

export function getCurrentStreakDays(): number {
  const sessions = getStoredSessions();
  if (sessions.length === 0) return 0;
  const days = new Set(sessions.map((s) => s.date));
  let streak = 0;
  const cursor = new Date();
  if (!days.has(isoDay(cursor))) cursor.setDate(cursor.getDate() - 1);
  while (days.has(isoDay(cursor))) {
    streak++;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

export interface MonthBucket {
  ym: string; // YYYY-MM
  label: string;
  booksFinished: number;
  minutes: number;
  pages: number;
}

const PL_MONTHS = [
  "Sty",
  "Lut",
  "Mar",
  "Kwi",
  "Maj",
  "Cze",
  "Lip",
  "Sie",
  "Wrz",
  "Paź",
  "Lis",
  "Gru",
];

export function getMonthlyBuckets(monthsBack = 6): MonthBucket[] {
  const sessions = getStoredSessions();
  const books = getAllEffectiveBooks();
  const now = new Date();
  const out: MonthBucket[] = [];
  for (let i = monthsBack - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const ym = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    out.push({
      ym,
      label: `${PL_MONTHS[d.getMonth()]} ${String(d.getFullYear()).slice(2)}`,
      booksFinished: 0,
      minutes: 0,
      pages: 0,
    });
  }
  const byYm = new Map(out.map((b) => [b.ym, b]));
  for (const s of sessions) {
    const ym = s.date.slice(0, 7);
    const b = byYm.get(ym);
    if (b) {
      b.minutes += s.minutes;
      b.pages += s.pagesRead;
    }
  }
  for (const book of books) {
    if (!book.finishedAt || book.status !== "finished") continue;
    const ym = book.finishedAt.slice(0, 7);
    const b = byYm.get(ym);
    if (b) b.booksFinished++;
  }
  return out;
}

export interface OverallStats {
  totalMinutes: number;
  totalPages: number;
  totalSessions: number;
  totalDaysRead: number;
  booksFinished: number;
  booksReading: number;
  booksQueue: number;
  notesCount: number;
  quotesCount: number;
  weekMinutes: number;
  streakDays: number;
  avgMinutesPerDay: number;
  avgRating: number | null;
}

export function getOverallStats(): OverallStats {
  const sessions = getStoredSessions();
  const books = getAllEffectiveBooks();
  const notes = getAllNotes();
  const totalMinutes = sessions.reduce((a, s) => a + s.minutes, 0);
  const totalPages = sessions.reduce((a, s) => a + s.pagesRead, 0);
  const daysSet = new Set(sessions.map((s) => s.date));
  const totalDaysRead = daysSet.size;

  let booksFinished = 0;
  let booksReading = 0;
  let booksQueue = 0;
  const ratings: number[] = [];
  for (const b of books) {
    if (b.status === "finished") booksFinished++;
    else if (b.status === "reading") booksReading++;
    else if (b.status === "queue") booksQueue++;
    if (typeof b.rating === "number") ratings.push(b.rating);
  }

  return {
    totalMinutes,
    totalPages,
    totalSessions: sessions.length,
    totalDaysRead,
    booksFinished,
    booksReading,
    booksQueue,
    notesCount: notes.length,
    quotesCount: notes.filter((n) => n.type === "quote").length,
    weekMinutes: getCurrentWeekMinutes(),
    streakDays: getCurrentStreakDays(),
    avgMinutesPerDay: totalDaysRead > 0 ? Math.round(totalMinutes / totalDaysRead) : 0,
    avgRating:
      ratings.length > 0
        ? Math.round((ratings.reduce((a, b) => a + b, 0) / ratings.length) * 10) / 10
        : null,
  };
}

export function formatMinutes(min: number): string {
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m === 0 ? `${h} g` : `${h} g ${m} min`;
}

export function getYearlyStats(year: number) {
  const sessions = getStoredSessions().filter((s) => s.date.startsWith(`${year}-`));
  const books = getAllEffectiveBooks();
  const totalMinutes = sessions.reduce((a, s) => a + s.minutes, 0);
  const totalPages = sessions.reduce((a, s) => a + s.pagesRead, 0);
  const daysRead = new Set(sessions.map((s) => s.date)).size;

  const finishedBooks = books.filter(
    (b) => b.status === "finished" && !!b.finishedAt && b.finishedAt.startsWith(`${year}-`),
  );

  const topRated = [...finishedBooks]
    .filter((b) => typeof b.rating === "number")
    .sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0))
    .slice(0, 5);

  const allNotes = getAllNotes();
  const favouriteQuotes = allNotes
    .filter((n) => n.type === "quote" && n.isFavourite && n.createdAt.startsWith(`${year}-`))
    .slice(0, 5);

  const tagCount = new Map<string, number>();
  for (const n of allNotes) {
    if (!n.createdAt.startsWith(`${year}-`)) continue;
    for (const t of n.tags ?? []) tagCount.set(t, (tagCount.get(t) ?? 0) + 1);
  }
  const topTags = [...tagCount.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([tag, count]) => ({ tag, count }));

  return {
    year,
    totalMinutes,
    totalPages,
    daysRead,
    sessions: sessions.length,
    finishedBooks,
    booksFinishedCount: finishedBooks.length,
    topRated,
    favouriteQuotes,
    topTags,
  };
}
