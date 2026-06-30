// Agata — Reading Progress widget.
// Renders a book's current progress with a "pages left / time left" hint.
// Two-line UI suitable for the home dashboard, the currently-reading section,
// and the book detail page.
//
// `computeReadingProgress` is the source of truth for math. The widget is a
// pure presentational shell around it; no state, no effects.

import { Clock, BookOpen } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  computeReadingProgress,
  formatEta,
  pagesLabel,
  type ReadingSessionInput,
} from "@/lib/reading-progress";

interface BookShape {
  pageCount?: number | null;
  currentPage?: number | null;
}

export interface ReadingProgressWidgetProps {
  book: BookShape;
  sessions: ReadonlyArray<ReadingSessionInput>;
  className?: string;
  /** When true, omits the icon row and shows a compact summary (mobile). */
  compact?: boolean;
}

export function ReadingProgressWidget({
  book,
  sessions,
  className,
  compact = false,
}: ReadingProgressWidgetProps) {
  const result = computeReadingProgress({
    pageCount: book.pageCount ?? 0,
    currentPage: book.currentPage ?? 0,
    sessions,
  });

  // Empty state: the book has no pageCount. Show a friendly hint and link.
  if (!book.pageCount) {
    return (
      <div
        data-testid="reading-progress-widget"
        data-state="empty"
        className={cn("glass rounded-2xl p-4 flex items-start gap-3", className)}
      >
        <BookOpen className="w-4 h-4 mt-0.5 text-warm-muted shrink-0" aria-hidden />
        <div className="min-w-0">
          <div className="text-sm font-medium">Brak danych o liczbie stron</div>
          <p className="text-xs text-warm-muted mt-0.5">
            Dodaj liczbę stron w „O książce”, żeby zobaczyć postęp i szacowany czas.
          </p>
        </div>
      </div>
    );
  }

  // 100% done. Render a celebratory strip.
  if (result.percent >= 100) {
    return (
      <div
        data-testid="reading-progress-widget"
        data-state="finished"
        className={cn("glass rounded-2xl p-4 flex items-center gap-3", className)}
      >
        <BookOpen className="w-4 h-4 text-emerald-600 shrink-0" aria-hidden />
        <div className="min-w-0 flex-1">
          <div className="text-sm font-medium">Przeczytane</div>
          <p className="text-xs text-warm-muted mt-0.5">Brawo! Książka ukończona.</p>
        </div>
        <div className="text-xs text-warm-muted shrink-0">100%</div>
      </div>
    );
  }

  const timeText = formatEta(result.estMinutes, result.estHours, result.estRemainingMinutes);

  return (
    <div
      data-testid="reading-progress-widget"
      data-state="reading"
      data-percent={result.percent}
      data-has-history={result.hasEnoughHistory ? "true" : "false"}
      className={cn("glass rounded-2xl p-4 space-y-2", className)}
    >
      <div className="flex items-baseline justify-between gap-3">
        <div className="text-sm font-medium">Postęp czytania</div>
        <div className="text-xs text-warm-muted shrink-0">
          {result.pagesLeft} {pagesLabel(result.pagesLeft)} do końca
        </div>
      </div>

      {/* Thin progress bar — same borderless style used elsewhere in the app. */}
      <div
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={result.percent}
        aria-label="Postęp czytania"
        className="h-1.5 rounded-full bg-[var(--glass-inner)] overflow-hidden"
      >
        <div
          className="h-full bg-[var(--accent-gold)] transition-[width] duration-300"
          style={{ width: `${result.percent}%` }}
        />
      </div>

      {!compact && (
        <div className="flex items-center gap-3 text-xs text-warm-muted">
          <span className="tabular-nums">{result.percent}%</span>
          <span aria-hidden>·</span>
          <Clock className="w-3.5 h-3.5" aria-hidden />
          <span>{timeText}</span>
        </div>
      )}

      {!result.hasEnoughHistory && (
        <p
          data-testid="reading-progress-hint"
          className="text-[11px] text-warm-muted/90 leading-snug"
        >
          Oszacowanie poprawi się po kilku sesjach czytania.
        </p>
      )}
    </div>
  );
}
