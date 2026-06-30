// Agata — pure reading-progress helper.
// Given a book's current page and the user's reading sessions, derive the
// percent read, pages left, and an ETA in minutes. The estimator falls back
// to a default 30 pages/hour (2 minutes/page) when the user has fewer than
// 5 pages of session history — pinned by `hasEnoughHistory: false` so the
// widget can render an "estimate will improve as you log more sessions"
// hint instead of pretending the guess is accurate.

export interface ReadingSessionInput {
  date: string;
  minutes: number;
  pagesRead: number;
}

export interface ComputeReadingProgressInput {
  pageCount: number;
  currentPage: number;
  sessions: ReadonlyArray<ReadingSessionInput>;
  /** Override the default 30 pages/hour used when there isn't enough history. */
  defaultPagesPerHour?: number;
  /** Threshold below which `hasEnoughHistory` returns false. Defaults to 5. */
  historyPagesThreshold?: number;
}

export interface ReadingProgressResult {
  /** 0-100. 0 when pageCount is missing or currentPage is 0. */
  percent: number;
  /** 0 when book is finished or pageCount is missing. */
  pagesLeft: number;
  /** Estimated minutes to finish (rounded up so the UI never shows "0 min"). */
  estMinutes: number;
  /** Floor(estMinutes / 60). 0 when estMinutes < 60. */
  estHours: number;
  /** Remainder minutes after extracting hours. */
  estRemainingMinutes: number;
  /** False when session history is too thin to trust the per-session rate. */
  hasEnoughHistory: boolean;
  /** avgPagesPerMinute used for the estimate (or defaultPagesPerHour/60). */
  avgPagesPerMinute: number;
}

const DEFAULT_PAGES_PER_HOUR = 30;
const DEFAULT_HISTORY_PAGES_THRESHOLD = 5;

/**
 * Format the ETA as a short Polish phrase suitable for inline UI:
 *   - 0 minutes  → em-dash (no estimate available)
 *   - < 60 min   → "45 min"
 *   - exact hour → "2 g"
 *   - mixed      → "2 g 15 min"
 *
 * Exported so the widget and tests both pin against one implementation.
 */
export function formatEta(
  estMinutes: number,
  estHours: number,
  estRemainingMinutes: number,
): string {
  if (estMinutes <= 0) return "—";
  if (estHours === 0) return `${estMinutes} min`;
  if (estRemainingMinutes === 0) return `${estHours} g`;
  return `${estHours} g ${estRemainingMinutes} min`;
}

/**
 * Polish plural for "strona" (book page). Pinned by `reading-progress.spec.ts`:
 *   1                       → "strona"   (exactly 1, 101, 201…)
 *   2..4, 22..24, 32..34…   → "strony"   (last digit 2..4, last two NOT 12..14)
 *   0, 5..21, 25..31, …     → "stron"
 *
 * Note: `lastTwo === 1` (not `last === 1`) — the latter would incorrectly
 * tag 11 and 21 as singular, since 11 and 21 both end in 1 but live in the
 * 5..21 "many" range.
 */
export function pagesLabel(n: number): string {
  const lastTwo = Math.abs(n) % 100;
  const last = lastTwo % 10;
  if (lastTwo >= 12 && lastTwo <= 14) return "stron";
  if (lastTwo === 1) return "strona";
  if (last >= 2 && last <= 4) return "strony";
  return "stron";
}

export function computeReadingProgress(input: ComputeReadingProgressInput): ReadingProgressResult {
  const {
    pageCount,
    currentPage,
    sessions,
    defaultPagesPerHour = DEFAULT_PAGES_PER_HOUR,
    historyPagesThreshold = DEFAULT_HISTORY_PAGES_THRESHOLD,
  } = input;

  const safePageCount = Math.max(0, Math.floor(pageCount));
  const safeCurrentPage = Math.max(0, Math.floor(currentPage));

  // Percent: clamp 0..100. 0 when there's no pageCount (can't compute) OR
  // when the reader hasn't started yet (currentPage <= 0).
  let percent = 0;
  if (safePageCount > 0 && safeCurrentPage > 0) {
    percent = Math.max(0, Math.min(100, Math.round((safeCurrentPage / safePageCount) * 100)));
  }

  // Pages left: 0 when there's no pageCount, never negative.
  let pagesLeft = 0;
  if (safePageCount > 0) {
    pagesLeft = Math.max(0, safePageCount - safeCurrentPage);
  }

  // Aggregate session history. A session with 0 minutes contributes nothing
  // to the rate (pages/min), but its pages still count toward history
  // accumulation so a single marathon read session can flip `hasEnoughHistory`
  // to true.
  let totalMinutes = 0;
  let totalPages = 0;
  for (const s of sessions) {
    if (!s || typeof s.minutes !== "number" || typeof s.pagesRead !== "number") continue;
    if (s.minutes < 0 || s.pagesRead < 0) continue;
    totalMinutes += s.minutes;
    totalPages += s.pagesRead;
  }
  const hasEnoughHistory = totalPages >= historyPagesThreshold;

  // Default rate (pages/min) when there's no usable session history.
  const defaultPagesPerMinute = defaultPagesPerHour / 60;
  const avgPagesPerMinute =
    hasEnoughHistory && totalMinutes > 0 ? totalPages / totalMinutes : defaultPagesPerMinute;

  // ETA. If pagesLeft is 0 (finished or no pageCount), estMinutes is 0.
  // Otherwise divide pagesLeft by the rate. When the default rate kicks in,
  // a 200-page book ≈ 400 minutes — close to the real 30 pph reading speed
  // for most fiction.
  let estMinutes = 0;
  if (pagesLeft > 0 && avgPagesPerMinute > 0) {
    estMinutes = Math.ceil(pagesLeft / avgPagesPerMinute);
  }
  const estHours = Math.floor(estMinutes / 60);
  const estRemainingMinutes = estMinutes - estHours * 60;

  return {
    percent,
    pagesLeft,
    estMinutes,
    estHours,
    estRemainingMinutes,
    hasEnoughHistory,
    avgPagesPerMinute,
  };
}
