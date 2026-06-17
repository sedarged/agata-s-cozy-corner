import { createFileRoute, Link } from "@tanstack/react-router";
import { books } from "@/lib/mock-data";
import { BookCover } from "@/components/BookCover";
import { Plus, Heart, BarChart3, Sparkles, Bookmark, BookOpen, FileText, Clock, ArrowRight, Star, Calendar } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Agata — Twoja prywatna biblioteka" },
      { name: "description", content: "Prywatna biblioteka, ulubione, statystyki, rekomendacje Gigi i książki w kolejce." },
    ],
  }),
  component: HomeMainMenu,
});

/* ============= Glass building blocks ============= */

function GlassTitlePill({ title, icon, flourish }: { title: string; icon?: ReactNode; flourish?: boolean }) {
  return (
    <div className="glass-pill px-6 py-3 flex items-center justify-center relative">
      {flourish && (
        <svg className="absolute left-6 gold-text opacity-80" width="22" height="10" viewBox="0 0 22 10" aria-hidden>
          <path d="M1 5 Q 6 0 11 5 T 21 5" stroke="currentColor" strokeWidth="0.7" fill="none" />
          <circle cx="3" cy="5" r="1" fill="currentColor" />
        </svg>
      )}
      <h2 className="font-serif text-xl sm:text-2xl text-warm tracking-wide">{title}</h2>
      {flourish && (
        <svg className="absolute right-6 gold-text opacity-80 scale-x-[-1]" width="22" height="10" viewBox="0 0 22 10" aria-hidden>
          <path d="M1 5 Q 6 0 11 5 T 21 5" stroke="currentColor" strokeWidth="0.7" fill="none" />
          <circle cx="3" cy="5" r="1" fill="currentColor" />
        </svg>
      )}
      {icon && <span className="absolute right-5 gold-text">{icon}</span>}
    </div>
  );
}

function SectionTitleBar({ title, icon }: { title: string; icon: ReactNode }) {
  return (
    <div className="glass-pill px-5 py-2.5 flex items-center justify-between">
      <h2 className="font-serif text-xl text-warm">{title}</h2>
      <span className="gold-text">{icon}</span>
    </div>
  );
}

function Stars({ value = 5 }: { value?: number }) {
  return (
    <div className="flex gap-0.5">
      {Array.from({ length: 5 }).map((_, i) => (
        <Star key={i} className={cn("w-3.5 h-3.5", i < value ? "gold-text fill-current" : "text-warm-muted opacity-30")} />
      ))}
    </div>
  );
}

/* ============= Sections ============= */

function BookShelfPreview() {
  const shelfBooks = books.slice(0, 5);
  return (
    <section className="space-y-4">
      <GlassTitlePill title="Moja biblioteka" flourish />
      <div className="relative">
        <Link
          to="/library"
          className="shelf block px-4 pt-6 pb-5 sm:px-6 sm:pt-8 sm:pb-6"
        >
          <div className="flex items-end justify-start gap-3 sm:gap-4 overflow-x-auto no-scrollbar pr-16">
            {shelfBooks.map((b) => (
              <Link
                key={b.id}
                to="/book/$id"
                params={{ id: b.id }}
                onClick={(e) => e.stopPropagation()}
                className="shrink-0 hover:-translate-y-1 transition"
              >
                <BookCover book={b} size="lg" className="!w-24 !h-36 sm:!w-28 sm:!h-44" />
              </Link>
            ))}
          </div>
        </Link>
        <Link
          to="/add-book"
          aria-label="Dodaj książkę"
          className="absolute right-2 sm:right-4 bottom-3 w-14 h-14 sm:w-16 sm:h-16 rounded-full grid place-items-center shadow-lg hover:scale-105 active:scale-95 transition glass-strong"
          style={{ boxShadow: "0 10px 30px -10px var(--shelf-shadow), 0 0 0 1px var(--glass-border)" }}
        >
          <span
            className="w-full h-full rounded-full grid place-items-center"
            style={{ background: "radial-gradient(circle at 30% 30%, var(--accent-gold), color-mix(in srgb, var(--accent-gold) 60%, var(--bg)))" }}
          >
            <Plus className="w-6 h-6" style={{ color: "var(--bg)" }} strokeWidth={2.5} />
          </span>
        </Link>
      </div>
    </section>
  );
}

function FavouritesSection() {
  const favs = books.filter((b) => b.isFavourite).slice(0, 3);
  if (favs.length === 0) {
    return (
      <section className="space-y-3">
        <SectionTitleBar title="Ulubione" icon={<Heart className="w-4 h-4" />} />
        <div className="glass p-8 text-center text-warm-muted text-sm rounded-3xl">
          Jeszcze nie masz ulubionych książek. Dotknij ❤︎ przy dowolnej książce.
        </div>
      </section>
    );
  }
  return (
    <section className="space-y-3">
      <SectionTitleBar title="Ulubione" icon={<Heart className="w-4 h-4" />} />
      <div className="flex gap-3 overflow-x-auto no-scrollbar pb-1 sm:grid sm:grid-cols-3 sm:gap-3">
        {favs.map((b) => (
          <Link
            key={b.id}
            to="/book/$id"
            params={{ id: b.id }}
            className="glass rounded-2xl p-3 flex gap-3 items-center min-w-[240px] sm:min-w-0 hover:shadow-warm transition"
          >
            <BookCover book={b} size="sm" className="!w-14 !h-20" />
            <div className="flex-1 min-w-0">
              <div className="font-serif text-base text-warm leading-tight line-clamp-2">{b.title}</div>
              <div className="text-xs text-warm-muted mt-0.5 line-clamp-1">{b.author}</div>
              <div className="mt-1.5"><Stars value={5} /></div>
            </div>
            <Heart className="w-4 h-4 gold-text fill-current shrink-0" />
          </Link>
        ))}
      </div>
    </section>
  );
}

function StatsSection() {
  const monthBars = [42, 38, 56, 48, 92, 39];
  const months = ["Sty", "Lut", "Mar", "Kwi", "Maj", "Cze"];
  return (
    <section className="space-y-3">
      <SectionTitleBar title="Statystyki" icon={<BarChart3 className="w-4 h-4" />} />
      <div className="glass rounded-3xl p-4 sm:p-5 space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
          <div className="glass-pill px-4 py-4 sm:col-span-1">
            <div className="text-xs text-warm-muted">Twoje czytanie w tym roku</div>
            <div className="mt-3 flex items-end gap-1.5 h-20">
              {monthBars.map((v, i) => (
                <div
                  key={i}
                  className="flex-1 rounded-t-sm self-end"
                  style={{
                    height: `${v}%`,
                    minHeight: 6,
                    background: i === 4 ? "var(--accent-gold)" : "color-mix(in srgb, var(--accent-gold) 45%, transparent)",
                  }}
                />
              ))}
            </div>
            <div className="mt-1 flex gap-1.5">
              {months.map((m) => (
                <div key={m} className="flex-1 text-center text-[10px] text-warm-muted">{m}</div>
              ))}
            </div>
          </div>

          {[
            { icon: BookOpen, value: "18", label: "książek przeczytanych" },
            { icon: FileText, value: "5 362", label: "strony" },
            { icon: Clock, value: "142 h", label: "czas czytania" },
          ].map((s) => (
            <div key={s.label} className="glass-pill px-4 py-4 text-center flex flex-col items-center justify-center">
              <s.icon className="w-4 h-4 gold-text mb-1.5" />
              <div className="font-serif text-2xl text-warm">{s.value}</div>
              <div className="text-[11px] text-warm-muted leading-tight mt-0.5">{s.label}</div>
            </div>
          ))}
        </div>
        <Link to="/statistics" className="glass-pill w-full px-4 py-2.5 flex items-center justify-center gap-2 text-sm text-warm hover:bg-[var(--glass-inner)]">
          Zobacz wszystkie statystyki <ArrowRight className="w-3.5 h-3.5 gold-text" />
        </Link>
      </div>
    </section>
  );
}

function GigiAvatar() {
  return (
    <svg viewBox="0 0 64 80" className="w-16 h-20 gold-text" aria-hidden>
      <g fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="32" cy="26" r="14" />
        <path d="M18 24 Q 20 12 32 11 Q 44 12 46 24" />
        <path d="M20 26 Q 22 18 32 17 Q 42 18 44 26" />
        <circle cx="27" cy="28" r="1" fill="currentColor" />
        <circle cx="37" cy="28" r="1" fill="currentColor" />
        <path d="M28 34 Q 32 36 36 34" />
        <path d="M14 78 Q 16 50 32 48 Q 48 50 50 78" />
      </g>
    </svg>
  );
}

function RecommendationsSection() {
  const recs = [books.find((b) => b.id === "6")!, books.find((b) => b.id === "7")!];
  return (
    <section className="space-y-3">
      <SectionTitleBar title="Polecane" icon={<Sparkles className="w-4 h-4" />} />
      <div className="glass rounded-3xl p-4 sm:p-5">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="flex gap-3 items-start">
            <GigiAvatar />
            <div className="flex-1 min-w-0">
              <div className="font-serif text-base text-warm flex items-center gap-1.5">
                Polecane przez Gigi <Heart className="w-3.5 h-3.5 gold-text" />
              </div>
              <p className="text-xs text-warm-muted leading-relaxed mt-1.5">
                Książki dobrane specjalnie dla Ciebie, na podstawie Twoich preferencji.
              </p>
            </div>
          </div>
          {recs.map((b) => (
            <div key={b.id} className="glass-pill rounded-2xl p-3 flex gap-3 items-center">
              <BookCover book={b} size="sm" className="!w-14 !h-20" />
              <div className="flex-1 min-w-0">
                <div className="font-serif text-base text-warm leading-tight line-clamp-2">{b.title}</div>
                <div className="text-xs text-warm-muted line-clamp-1">{b.author}</div>
                <div className="mt-1"><Stars value={4} /></div>
                <Link
                  to="/book/$id"
                  params={{ id: b.id }}
                  className="mt-1.5 inline-block text-[11px] px-3 py-1 rounded-full border border-[var(--glass-border)] text-warm hover:bg-[var(--glass-inner)]"
                >
                  Zobacz
                </Link>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function QueueSection() {
  const queue = books.filter((b) => b.status === "queue").slice(0, 3);
  return (
    <section className="space-y-3">
      <SectionTitleBar title="W kolejce" icon={<Bookmark className="w-4 h-4" />} />
      <div className="flex gap-3 overflow-x-auto no-scrollbar pb-1 sm:grid sm:grid-cols-3 sm:gap-3">
        {queue.map((b) => (
          <Link
            key={b.id}
            to="/book/$id"
            params={{ id: b.id }}
            className="glass rounded-2xl p-3 flex gap-3 items-center min-w-[240px] sm:min-w-0 hover:shadow-warm transition"
          >
            <BookCover book={b} size="sm" className="!w-14 !h-20" />
            <div className="flex-1 min-w-0">
              <div className="font-serif text-base text-warm leading-tight line-clamp-2">{b.title}</div>
              <div className="text-xs text-warm-muted mt-0.5 line-clamp-1">{b.author}</div>
              <div className="mt-1.5 flex items-center gap-1.5 text-[11px] text-warm-muted">
                <Calendar className="w-3.5 h-3.5 gold-text" /> Planowana
              </div>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}

/* ============= Main ============= */

function HomeMainMenu() {
  return (
    <div className="px-4 sm:px-6 lg:px-10 pb-16 max-w-5xl mx-auto space-y-5 pt-2">
      <BookShelfPreview />
      <FavouritesSection />
      <StatsSection />
      <RecommendationsSection />
      <QueueSection />
    </div>
  );
}
