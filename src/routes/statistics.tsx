import { createFileRoute, Link } from "@tanstack/react-router";
import { PageHeader } from "@/components/PageHeader";
import { GoalRing } from "@/components/GoalRing";
import { BookCover } from "@/components/BookCover";
import { getOverallStats, getLastNDays, getMonthlyBuckets, formatMinutes } from "@/lib/stats";
import { getGoals, useGoalsVersion } from "@/lib/goals-store";
import { getAllEffectiveBooks, useEffectiveBooksVersion } from "@/lib/effective-books";
import { useNotesVersion, getAllNotes } from "@/lib/notes-store";
import { Sparkles } from "lucide-react";

export const Route = createFileRoute("/statistics")({
  head: () => ({ meta: [{ title: "Statystyki — Agata" }] }),
  component: Statistics,
});

function Statistics() {
  useEffectiveBooksVersion();
  useNotesVersion();
  useGoalsVersion();

  const stats = getOverallStats();
  const goals = getGoals();
  const last30 = getLastNDays(30);
  const last7 = getLastNDays(7);
  const months = getMonthlyBuckets(6);
  const maxDay = Math.max(1, ...last30.map((d) => d.minutes));
  const maxWeekPages = Math.max(1, ...last7.map((d) => d.pages));
  const maxMonth = Math.max(1, ...months.map((m) => m.minutes));

  const yearFinished = (() => {
    const y = new Date().getFullYear();
    return getMonthlyBuckets(12)
      .filter((m) => m.ym.startsWith(`${y}-`))
      .reduce((a, m) => a + m.booksFinished, 0);
  })();

  const PL_DAY = ["Nd", "Pn", "Wt", "Śr", "Cz", "Pt", "So"];
  const week7Labels = last7.map((d) => {
    const day = new Date(d.date + "T00:00:00");
    return PL_DAY[day.getDay()];
  });

  const allNotes = getAllNotes();
  const tagCount = new Map<string, number>();
  for (const n of allNotes)
    for (const t of n.tags ?? []) tagCount.set(t, (tagCount.get(t) ?? 0) + 1);
  const topTags = [...tagCount.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10);

  const topRated = getAllEffectiveBooks()
    .filter((b) => typeof b.rating === "number")
    .sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0))
    .slice(0, 4);

  const tiles = [
    { l: "Przeczytane strony", v: stats.totalPages.toLocaleString("pl-PL") },
    { l: "Czas czytania", v: formatMinutes(stats.totalMinutes) },
    { l: "Dni czytania", v: stats.totalDaysRead },
    { l: "Ukończone książki", v: stats.booksFinished },
    { l: "Notatki", v: stats.notesCount },
    { l: "Cytaty", v: stats.quotesCount },
    { l: "Aktualna passa", v: `${stats.streakDays} dni` },
    {
      l: "Średnia ocena",
      v: stats.avgRating !== null ? stats.avgRating.toString().replace(".", ",") : "—",
    },
  ];

  return (
    <div>
      <PageHeader title="Statystyki" subtitle="Twoje czytanie w liczbach." />
      <div className="px-5 lg:px-10 pb-12 space-y-6 max-w-6xl">
        <div className="bg-card rounded-3xl p-6 shadow-soft">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-serif text-lg">Cele</h3>
            <Link to="/settings" className="text-xs text-primary hover:underline">
              Edytuj cele
            </Link>
          </div>
          <div className="flex flex-wrap items-center justify-around gap-6">
            <GoalRing
              value={yearFinished}
              goal={goals.yearlyBooks}
              label={`Książki ${new Date().getFullYear()}`}
              unit="książek"
            />
            <GoalRing
              value={stats.weekMinutes}
              goal={goals.weeklyMinutes}
              label="Ten tydzień"
              unit="min"
            />
            <GoalRing
              value={stats.streakDays}
              goal={Math.max(7, stats.streakDays)}
              label="Passa"
              unit="dni"
            />
          </div>
        </div>

        <Link
          to="/year-in-review"
          className="block bg-gradient-to-br from-primary/15 to-primary/5 rounded-3xl p-6 shadow-soft hover:from-primary/20 transition"
        >
          <div className="flex items-center gap-3">
            <Sparkles className="w-6 h-6 text-primary" aria-hidden="true" />
            <div>
              <div className="font-serif text-lg">Rok w czytaniu</div>
              <div className="text-sm text-muted-foreground">
                Podsumowanie {new Date().getFullYear()} — top książki, cytaty, godziny.
              </div>
            </div>
          </div>
        </Link>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {tiles.map((s) => (
            <div key={s.l} className="bg-card rounded-2xl p-5 shadow-soft text-center">
              <div className="font-serif text-2xl">{s.v}</div>
              <div className="text-[10px] uppercase tracking-widest text-muted-foreground mt-1">
                {s.l}
              </div>
            </div>
          ))}
        </div>

        <div className="grid lg:grid-cols-2 gap-6">
          <div className="bg-card rounded-3xl p-6 shadow-soft">
            <h3 className="font-serif text-lg mb-4">Strony w tym tygodniu</h3>
            {stats.totalSessions === 0 ? (
              <EmptyState text="Dodaj pierwszą sesję czytania, aby zobaczyć tygodniowy wykres." />
            ) : (
              <div className="flex items-end gap-3 h-48">
                {last7.map((d, i) => (
                  <div key={d.date} className="flex-1 flex flex-col items-center gap-2">
                    <div
                      className="w-full bg-primary/80 rounded-t-md min-h-[2px]"
                      style={{ height: `${(d.pages / maxWeekPages) * 100}%` }}
                      title={`${d.pages} stron`}
                    />
                    <div className="text-[10px] text-muted-foreground">{week7Labels[i]}</div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="bg-card rounded-3xl p-6 shadow-soft">
            <h3 className="font-serif text-lg mb-4">Minuty czytania — ostatnie 30 dni</h3>
            {stats.totalSessions === 0 ? (
              <EmptyState text="Brak sesji w ostatnim miesiącu." />
            ) : (
              <svg
                viewBox={`0 0 ${last30.length * 6} 100`}
                className="w-full h-48"
                preserveAspectRatio="none"
              >
                <polyline
                  fill="none"
                  stroke="var(--primary)"
                  strokeWidth="1.2"
                  points={last30
                    .map((d, i) => `${i * 6},${100 - (d.minutes / maxDay) * 95}`)
                    .join(" ")}
                />
                <polygon
                  fill="var(--primary)"
                  opacity="0.15"
                  points={`${last30.map((d, i) => `${i * 6},${100 - (d.minutes / maxDay) * 95}`).join(" ")} ${(last30.length - 1) * 6},100 0,100`}
                />
              </svg>
            )}
          </div>
        </div>

        <div className="bg-card rounded-3xl p-6 shadow-soft">
          <h3 className="font-serif text-lg mb-4">Ostatnie 6 miesięcy</h3>
          {stats.totalSessions === 0 && stats.booksFinished === 0 ? (
            <EmptyState text="Brak danych miesięcznych." />
          ) : (
            <div className="grid grid-cols-6 gap-3 items-end h-48">
              {months.map((m) => (
                <div key={m.ym} className="flex flex-col items-center gap-2 h-full justify-end">
                  <div className="text-[10px] text-muted-foreground">
                    {m.booksFinished > 0 ? `${m.booksFinished} ks.` : ""}
                  </div>
                  <div
                    className="w-full bg-primary/70 rounded-t-md min-h-[2px]"
                    style={{ height: `${(m.minutes / maxMonth) * 80}%` }}
                    title={`${formatMinutes(m.minutes)} • ${m.booksFinished} książek`}
                  />
                  <div className="text-[10px] text-muted-foreground">{m.label}</div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="grid lg:grid-cols-2 gap-6">
          <div className="bg-card rounded-3xl p-6 shadow-soft">
            <h3 className="font-serif text-lg mb-4">Najwyżej oceniane</h3>
            {topRated.length === 0 ? (
              <EmptyState text="Brak ocenionych książek." />
            ) : (
              <div className="space-y-3">
                {topRated.map((b) => (
                  <Link
                    key={b.id}
                    to="/book/$id"
                    params={{ id: b.id }}
                    className="flex items-center gap-3 hover:bg-muted/50 rounded-xl p-1.5 -m-1.5 transition"
                  >
                    <BookCover book={b} size="sm" className="!w-10 !h-14" />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium line-clamp-1">{b.title}</div>
                      <div className="text-xs text-muted-foreground">{b.author}</div>
                    </div>
                    <div className="font-serif text-lg">{b.rating}/10</div>
                  </Link>
                ))}
              </div>
            )}
          </div>

          <div className="bg-card rounded-3xl p-6 shadow-soft">
            <h3 className="font-serif text-lg mb-4">Najczęstsze tagi</h3>
            {topTags.length === 0 ? (
              <EmptyState text="Brak tagów — dodaj je w notatkach." />
            ) : (
              <div className="flex flex-wrap gap-2">
                {topTags.map(([t, n], i) => (
                  <span
                    key={t}
                    className="px-3 py-1.5 rounded-full bg-muted text-sm"
                    style={{ fontSize: `${Math.max(0.75, 1 - i * 0.03)}rem` }}
                  >
                    {t} <span className="text-muted-foreground">·{n}</span>
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="text-sm text-muted-foreground text-center py-8 px-4 border border-dashed border-border rounded-2xl">
      {text}
    </div>
  );
}
