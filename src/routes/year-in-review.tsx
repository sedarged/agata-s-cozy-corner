import { createFileRoute, Link } from "@tanstack/react-router";
import { PageHeader } from "@/components/PageHeader";
import { BookCover } from "@/components/BookCover";
import { useState } from "react";
import { getYearlyStats, formatMinutes } from "@/lib/stats";
import { useWorkspaceVersion } from "@/lib/book-workspace-store";
import { useBooksVersion } from "@/lib/books-store";
import { useNotesVersion } from "@/lib/notes-store";
import { Sparkles, Share2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/year-in-review")({
  head: () => ({ meta: [{ title: "Rok w czytaniu — Agata" }] }),
  component: YearInReview,
});

function YearInReview() {
  useWorkspaceVersion();
  useBooksVersion();
  useNotesVersion();

  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState(currentYear);
  const data = getYearlyStats(year);
  const years = [currentYear, currentYear - 1, currentYear - 2];

  const shareText = () => {
    const lines = [
      `📚 Mój rok w czytaniu ${year} — Agata`,
      `Ukończone książki: ${data.booksFinishedCount}`,
      `Przeczytane strony: ${data.totalPages.toLocaleString("pl-PL")}`,
      `Czas czytania: ${formatMinutes(data.totalMinutes)}`,
      `Dni z czytaniem: ${data.daysRead}`,
    ];
    if (data.topRated[0]) lines.push(`Top książka: „${data.topRated[0].title}" — ${data.topRated[0].author}`);
    return lines.join("\n");
  };

  const handleShare = async () => {
    const text = shareText();
    try {
      if (navigator.share) {
        await navigator.share({ title: `Rok w czytaniu ${year}`, text });
        return;
      }
    } catch {
      /* fall through */
    }
    try {
      await navigator.clipboard.writeText(text);
      toast.success("Podsumowanie skopiowane do schowka");
    } catch {
      toast.error("Nie udało się udostępnić");
    }
  };

  const hasAnyData =
    data.totalMinutes > 0 ||
    data.totalPages > 0 ||
    data.booksFinishedCount > 0 ||
    data.favouriteQuotes.length > 0;

  return (
    <div>
      <PageHeader title="Rok w czytaniu" subtitle={`Twoje czytelnicze podsumowanie roku ${year}.`} />
      <div className="px-5 lg:px-10 pb-12 space-y-6 max-w-4xl">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex gap-2">
            {years.map((y) => (
              <button
                key={y}
                onClick={() => setYear(y)}
                className={`px-4 py-2 rounded-xl text-sm transition ${
                  y === year ? "bg-primary text-primary-foreground" : "bg-card hover:bg-muted"
                }`}
              >
                {y}
              </button>
            ))}
          </div>
          <button
            onClick={handleShare}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-card hover:bg-muted text-sm"
          >
            <Share2 className="w-4 h-4" />
            Udostępnij
          </button>
        </div>

        {!hasAnyData ? (
          <div className="bg-card rounded-3xl p-10 shadow-soft text-center space-y-3">
            <Sparkles className="w-10 h-10 mx-auto text-primary" />
            <h3 className="font-serif text-xl">Jeszcze niewiele danych za {year}</h3>
            <p className="text-sm text-muted-foreground max-w-md mx-auto">
              Dodaj sesje czytania, oznacz ukończone książki i zapisuj cytaty. Podsumowanie wypełni się samo.
            </p>
            <Link
              to="/library"
              className="inline-block mt-3 px-5 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm"
            >
              Otwórz bibliotekę
            </Link>
          </div>
        ) : (
          <>
            {/* Hero numbers */}
            <div className="bg-gradient-to-br from-primary/15 to-primary/5 rounded-3xl p-8 shadow-soft">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
                <Big v={data.booksFinishedCount} l="książek ukończonych" />
                <Big v={data.totalPages.toLocaleString("pl-PL")} l="stron przeczytanych" />
                <Big v={formatMinutes(data.totalMinutes)} l="czytania" />
                <Big v={data.daysRead} l="dni z czytaniem" />
              </div>
            </div>

            {/* Top rated */}
            {data.topRated.length > 0 && (
              <div className="bg-card rounded-3xl p-6 shadow-soft">
                <h3 className="font-serif text-lg mb-4">Top książki roku</h3>
                <div className="grid sm:grid-cols-2 gap-3">
                  {data.topRated.map((b) => (
                    <Link
                      key={b.id}
                      to="/book/$id"
                      params={{ id: b.id }}
                      className="flex items-center gap-3 p-3 rounded-2xl bg-muted/40 hover:bg-muted transition"
                    >
                      <BookCover book={b} size="sm" className="!w-12 !h-16" />
                      <div className="flex-1 min-w-0">
                        <div className="font-medium line-clamp-1">{b.title}</div>
                        <div className="text-xs text-muted-foreground">{b.author}</div>
                      </div>
                      <div className="font-serif text-xl">{b.rating}/10</div>
                    </Link>
                  ))}
                </div>
              </div>
            )}

            {/* Finished list */}
            {data.finishedBooks.length > 0 && (
              <div className="bg-card rounded-3xl p-6 shadow-soft">
                <h3 className="font-serif text-lg mb-4">
                  Wszystkie ukończone w {year} ({data.finishedBooks.length})
                </h3>
                <div className="flex gap-3 overflow-x-auto pb-2 -mx-1 px-1">
                  {data.finishedBooks.map((b) => (
                    <Link
                      key={b.id}
                      to="/book/$id"
                      params={{ id: b.id }}
                      className="flex-shrink-0 w-24"
                    >
                      <BookCover book={b} size="sm" className="!w-24 !h-32" />
                      <div className="text-xs mt-1.5 line-clamp-2">{b.title}</div>
                    </Link>
                  ))}
                </div>
              </div>
            )}

            {/* Favourite quotes */}
            {data.favouriteQuotes.length > 0 && (
              <div className="bg-card rounded-3xl p-6 shadow-soft">
                <h3 className="font-serif text-lg mb-4">Ulubione cytaty</h3>
                <div className="space-y-4">
                  {data.favouriteQuotes.map((q) => (
                    <blockquote
                      key={q.id}
                      className="border-l-2 border-primary pl-4 italic text-sm leading-relaxed"
                    >
                      „{q.quoteText ?? q.content}"
                      {q.pageNumber && (
                        <div className="not-italic text-xs text-muted-foreground mt-1">
                          s. {q.pageNumber}
                        </div>
                      )}
                    </blockquote>
                  ))}
                </div>
              </div>
            )}

            {/* Top tags */}
            {data.topTags.length > 0 && (
              <div className="bg-card rounded-3xl p-6 shadow-soft">
                <h3 className="font-serif text-lg mb-4">Tematy roku</h3>
                <div className="flex flex-wrap gap-2">
                  {data.topTags.map(({ tag, count }, i) => (
                    <span
                      key={tag}
                      className="px-3 py-1.5 rounded-full bg-muted text-sm"
                      style={{ fontSize: `${Math.max(0.8, 1.1 - i * 0.04)}rem` }}
                    >
                      {tag} <span className="text-muted-foreground">·{count}</span>
                    </span>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function Big({ v, l }: { v: string | number; l: string }) {
  return (
    <div>
      <div className="font-serif text-3xl md:text-4xl">{v}</div>
      <div className="text-[11px] uppercase tracking-widest text-muted-foreground mt-1">{l}</div>
    </div>
  );
}
