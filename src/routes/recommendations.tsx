import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { BookCover } from "@/components/BookCover";
import { PageHeader } from "@/components/PageHeader";
import {
  getAllEffectiveBooks,
  useEffectiveBooksVersion,
  type EffectiveBook,
} from "@/lib/effective-books";
import { updateBookState } from "@/lib/book-workspace-store";
import { toast } from "sonner";
import { Info } from "lucide-react";

export const Route = createFileRoute("/recommendations")({
  head: () => ({ meta: [{ title: "Polecane — Agata" }] }),
  component: Recs,
});

interface Scored {
  book: EffectiveBook;
  score: number;
  reasons: string[];
  addedAt: string;
}

type SortKey = "best" | "newest" | "author";

function buildRecommendations(all: EffectiveBook[]): Scored[] {
  const signals = all.filter(
    (b) => b.isFavourite || b.status === "finished" || (b.rating ?? 0) >= 8,
  );
  if (signals.length === 0) return [];

  const authorWeight = new Map<string, number>();
  const genreWeight = new Map<string, number>();
  const tagWeight = new Map<string, number>();
  for (const s of signals) {
    const w = ((s.rating ?? 7) - 5) / 2;
    authorWeight.set(s.author, (authorWeight.get(s.author) ?? 0) + w);
    if (s.genre) genreWeight.set(s.genre, (genreWeight.get(s.genre) ?? 0) + w);
    for (const t of s.tags ?? []) tagWeight.set(t, (tagWeight.get(t) ?? 0) + w);
  }

  const candidates = all.filter(
    (b) => b.status !== "finished" && (b.status === "queue" || b.status === "paused"),
  );
  const scored: Scored[] = [];
  for (const b of candidates) {
    let score = 0;
    const reasons: string[] = [];
    const aw = authorWeight.get(b.author);
    if (aw) {
      score += 5 + aw * 2;
      reasons.push(`ten sam autor co Twoje ulubione: ${b.author}`);
    }
    const gw = b.genre ? genreWeight.get(b.genre) : undefined;
    if (gw) {
      score += 3 + gw;
      reasons.push(`lubisz gatunek: ${b.genre}`);
    }
    const sharedTags = (b.tags ?? []).filter((t) => tagWeight.has(t));
    if (sharedTags.length) {
      score += sharedTags.reduce((acc, t) => acc + 1 + (tagWeight.get(t) ?? 0) * 0.4, 0);
      reasons.push(`wspólne motywy: ${sharedTags.slice(0, 3).join(", ")}`);
    }
    if ((b.rating ?? 0) >= 8) {
      score += 1;
      reasons.push(`Twoja ocena: ${b.rating}/10`);
    }
    if (score > 0) scored.push({ book: b, score, reasons, addedAt: b.addedAt ?? b.id });
  }
  return scored;
}

function Recs() {
  useEffectiveBooksVersion();
  const all = getAllEffectiveBooks();
  const recs = useMemo(() => buildRecommendations(all), [all]);
  const [sort, setSort] = useState<SortKey>("best");

  const sorted = useMemo(() => {
    const list = [...recs];
    if (sort === "best") list.sort((a, b) => b.score - a.score);
    if (sort === "author") list.sort((a, b) => a.book.author.localeCompare(b.book.author, "pl"));
    if (sort === "newest") list.sort((a, b) => (b.addedAt || "").localeCompare(a.addedAt || ""));
    return list.slice(0, 12);
  }, [recs, sort]);

  const maxScore = recs[0]?.score ?? 1;

  const startReading = (b: EffectiveBook) => {
    updateBookState(b.id, { status: "reading" });
    toast.success(`„${b.title}” przeniesione do czytanych.`);
  };

  return (
    <div>
      <PageHeader
        title="Polecane dla Ciebie"
        subtitle="Dobrane na podstawie Twojej biblioteki: autorów, gatunków i tagów, które oceniasz wysoko."
      />

      <div className="px-5 lg:px-10 mb-4 flex flex-wrap items-center gap-2">
        <span className="text-xs text-warm-muted mr-1">Sortuj:</span>
        {(
          [
            ["best", "Najlepsze dopasowanie"],
            ["newest", "Najnowsze dodane"],
            ["author", "Autor"],
          ] as const
        ).map(([k, label]) => (
          <button
            key={k}
            onClick={() => setSort(k)}
            aria-pressed={sort === k}
            className={`px-3 py-1.5 rounded-full text-xs border ${
              sort === k
                ? "bg-[var(--accent-gold)] text-[var(--bg)] border-[var(--accent-gold)]"
                : "bg-card text-foreground border-border hover:bg-muted"
            }`}
          >
            {label}
          </button>
        ))}
        <span
          className="ml-auto inline-flex items-center gap-1.5 text-[11px] text-warm-muted"
          title="Wynik dopasowania liczymy na podstawie podobnych autorów, gatunków, tagów oraz Twoich wysokich ocen."
        >
          <Info className="w-3.5 h-3.5" aria-hidden="true" />
          Dlaczego polecane?
        </span>
      </div>

      <div className="px-5 lg:px-10 space-y-5 pb-12 max-w-3xl">
        {sorted.length === 0 && (
          <div className="glass rounded-3xl p-8 text-center">
            <p className="text-sm text-warm-muted">
              Dodaj i oceń kilka książek, żeby zobaczyć lepsze polecenia.
            </p>
          </div>
        )}
        {sorted.map((r) => {
          const match = Math.round((r.score / maxScore) * 100);
          return (
            <div key={r.book.id} className="glass rounded-3xl p-6 flex gap-5">
              <BookCover book={r.book} size="lg" />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <div className="text-[10px] uppercase tracking-widest gold-text">
                    {match}% dopasowania
                  </div>
                  <span
                    title={`Wynik: ${r.reasons.join(" · ") || "—"}`}
                    aria-label="Dlaczego polecane?"
                    className="text-warm-muted"
                  >
                    <Info className="w-3.5 h-3.5" aria-hidden="true" />
                  </span>
                </div>
                <div className="font-serif text-2xl mt-1">{r.book.title}</div>
                <div className="text-sm text-warm-muted">{r.book.author}</div>
                <ul className="text-sm mt-3 leading-relaxed space-y-1 text-warm">
                  {r.reasons.map((reason, i) => (
                    <li key={i}>· {reason}</li>
                  ))}
                </ul>
                <div className="flex flex-wrap gap-2 mt-4">
                  <button
                    onClick={() => startReading(r.book)}
                    className="px-3 py-1.5 rounded-full bg-[var(--accent-gold)] text-[var(--bg)] text-xs"
                  >
                    Zacznij czytać
                  </button>
                  <Link
                    to="/book/$id"
                    params={{ id: r.book.id }}
                    className="px-3 py-1.5 rounded-full glass text-warm text-xs"
                  >
                    Szczegóły
                  </Link>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
