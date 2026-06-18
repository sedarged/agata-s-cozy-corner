import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo } from "react";
import { BookCover } from "@/components/BookCover";
import { PageHeader } from "@/components/PageHeader";
import { getAllBooks, useBooksVersion, updateBook } from "@/lib/books-store";
import type { Book } from "@/lib/mock-data";
import { toast } from "sonner";

export const Route = createFileRoute("/recommendations")({
  head: () => ({ meta: [{ title: "Polecane — Agata" }] }),
  component: Recs,
});

interface Scored {
  book: Book;
  score: number;
  reasons: string[];
}

function buildRecommendations(all: Book[]): Scored[] {
  const signals = all.filter(
    (b) => b.isFavourite || b.status === "finished" || (b.rating ?? 0) >= 8,
  );
  if (signals.length === 0) return [];

  const authorWeight = new Map<string, number>();
  const genreWeight = new Map<string, number>();
  const tagWeight = new Map<string, number>();
  for (const s of signals) {
    const w = ((s.rating ?? 7) - 5) / 2; // 0..2.5
    authorWeight.set(s.author, (authorWeight.get(s.author) ?? 0) + w);
    if (s.genre) genreWeight.set(s.genre, (genreWeight.get(s.genre) ?? 0) + w);
    for (const t of s.tags ?? []) tagWeight.set(t, (tagWeight.get(t) ?? 0) + w);
  }

  const candidates = all.filter((b) => b.status === "queue" || b.status === "paused");
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
    if (score > 0) scored.push({ book: b, score, reasons });
  }

  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, 8);
}

function Recs() {
  useBooksVersion();
  const all = getAllBooks();
  const recs = useMemo(() => buildRecommendations(all), [all]);
  const maxScore = recs[0]?.score ?? 1;

  const startReading = (b: Book) => {
    updateBook(b.id, { status: "reading" });
    toast.success(`„${b.title}" przeniesione do czytanych.`);
  };

  return (
    <div>
      <PageHeader
        title="Polecane dla Ciebie"
        subtitle="Dobrane na podstawie Twojej biblioteki: autorów, gatunków i tagów, które oceniasz wysoko."
      />
      <div className="px-5 lg:px-10 space-y-5 pb-12 max-w-3xl">
        {recs.length === 0 && (
          <div className="glass rounded-3xl p-8 text-center">
            <p className="text-sm text-warm-muted">
              Oceń lub oznacz jako ulubione kilka książek, a zaproponuję podobne tytuły z Twojej
              kolejki.
            </p>
          </div>
        )}
        {recs.map((r) => {
          const match = Math.round((r.score / maxScore) * 100);
          return (
            <div
              key={r.book.id}
              className="glass rounded-3xl p-6 flex gap-5"
            >
              <BookCover book={r.book} size="lg" />
              <div className="flex-1 min-w-0">
                <div className="text-[10px] uppercase tracking-widest gold-text">
                  {match}% dopasowania
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
