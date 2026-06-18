import { createFileRoute, Link } from "@tanstack/react-router";
import { getAllBooks, useBooksVersion } from "@/lib/books-store";
import { getStoredSessions } from "@/lib/book-workspace-store";
import { BookCover } from "@/components/BookCover";
import {
  Plus,
  Heart,
  BarChart3,
  Sparkles,
  Bookmark,
  BookOpen,
  FileText,
  Clock,
  ArrowRight,
  Star,
  Calendar,
} from "lucide-react";
import type { ReactNode } from "react";
import { useMemo } from "react";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Agata — Twoja prywatna biblioteka" },
      {
        name: "description",
        content: "Prywatna biblioteka, ulubione, statystyki, polecane od Gigi i książki w kolejce.",
      },
    ],
  }),
  component: HomeMainMenu,
});

function GlassTitlePill({ title, flourish }: { title: string; flourish?: boolean }) {
  return (
    <div className="agata-title-pill agata-sheen px-7 py-3 sm:py-3.5 flex items-center justify-center relative">
      {flourish && (
        <svg
          className="absolute left-6 gold-text opacity-80"
          width="28"
          height="12"
          viewBox="0 0 28 12"
          aria-hidden
        >
          <path d="M1 6 Q 7 1 13 6 T 27 6" stroke="currentColor" strokeWidth="0.8" fill="none" />
          <circle cx="3.5" cy="6" r="1" fill="currentColor" />
        </svg>
      )}
      <h2 className="font-serif text-[1.7rem] sm:text-[2rem] text-warm tracking-[0.01em] leading-none">
        {title}
      </h2>
      {flourish && (
        <svg
          className="absolute right-6 gold-text opacity-80 scale-x-[-1]"
          width="28"
          height="12"
          viewBox="0 0 28 12"
          aria-hidden
        >
          <path d="M1 6 Q 7 1 13 6 T 27 6" stroke="currentColor" strokeWidth="0.8" fill="none" />
          <circle cx="3.5" cy="6" r="1" fill="currentColor" />
        </svg>
      )}
    </div>
  );
}

function SectionTitleBar({ title, icon }: { title: string; icon: ReactNode }) {
  return (
    <div className="agata-section-title px-5 py-2.5 sm:py-3 flex items-center justify-between">
      <h2 className="font-serif text-[1.55rem] sm:text-[1.85rem] text-warm leading-none">
        {title}
      </h2>
      <span className="gold-text">{icon}</span>
    </div>
  );
}

function SectionPanel({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn("agata-section-panel agata-sheen p-4 sm:p-5", className)}>{children}</div>
  );
}

function Stars({ value = 5 }: { value?: number }) {
  return (
    <div className="flex gap-0.5">
      {Array.from({ length: 5 }).map((_, i) => (
        <Star
          key={i}
          className={cn(
            "w-3.5 h-3.5",
            i < value ? "gold-text fill-current" : "text-warm-muted opacity-30",
          )}
        />
      ))}
    </div>
  );
}

import type { Book } from "@/lib/mock-data";

function FavouriteBookCard({ book }: { book: Book }) {
  return (
    <Link
      to="/book/$id"
      params={{ id: book.id }}
      className="agata-inline-card p-3 min-w-[256px] sm:min-w-[280px] flex items-center gap-3 hover:translate-y-[-1px] transition shrink-0"
    >
      <BookCover book={book} size="sm" className="!w-[80px] !h-[118px]" />
      <div className="flex-1 min-w-0 self-stretch flex flex-col justify-center pr-7 relative">
        <div className="font-serif text-[1rem] text-warm leading-[1.05] line-clamp-2">
          {book.title}
        </div>
        <div className="text-[0.78rem] text-warm-muted mt-1 line-clamp-1">{book.author}</div>
        <div className="mt-3">
          <Stars value={book.rating ?? 5} />
        </div>
        <Heart className="absolute right-0 bottom-1 w-4 h-4 gold-text" />
      </div>
    </Link>
  );
}

function QueueBookCard({ book }: { book: Book }) {
  return (
    <Link
      to="/book/$id"
      params={{ id: book.id }}
      className="agata-inline-card p-3 min-w-[256px] sm:min-w-[280px] flex items-center gap-3 hover:translate-y-[-1px] transition shrink-0"
    >
      <BookCover book={book} size="sm" className="!w-[80px] !h-[118px]" />
      <div className="flex-1 min-w-0 self-stretch flex flex-col justify-center">
        <div className="font-serif text-[1rem] text-warm leading-[1.05] line-clamp-2">
          {book.title}
        </div>
        <div className="text-[0.78rem] text-warm-muted mt-1 line-clamp-1">{book.author}</div>
        <div className="mt-3 flex items-center gap-1.5 text-[0.78rem] text-warm-muted">
          <Calendar className="w-3.5 h-3.5 gold-text" /> Planowana
        </div>
      </div>
    </Link>
  );
}

function RecommendationPreviewCard({ book }: { book: Book }) {
  return (
    <div className="agata-reco-card p-3.5 flex items-center gap-4 min-w-[260px] sm:min-w-0 shrink-0 sm:shrink">
      <BookCover book={book} size="sm" className="!w-[84px] !h-[122px]" />
      <div className="flex-1 min-w-0">
        <div className="font-serif text-[1rem] sm:text-[1.08rem] text-warm leading-[1.05] line-clamp-2">
          {book.title}
        </div>
        <div className="text-[0.8rem] text-warm-muted mt-1">{book.author}</div>
        <div className="mt-3">
          <Stars value={book.rating ?? 4} />
        </div>
        <Link
          to="/book/$id"
          params={{ id: book.id }}
          className="agata-mini-button mt-3 inline-flex"
        >
          Zobacz
        </Link>
      </div>
    </div>
  );
}

function EmptySectionNote() {
  return (
    <div className="text-sm text-warm-muted px-2 py-3">Brak książek w tej sekcji</div>
  );
}

function BookShelfPreview() {
  const shelfBooks = getAllBooks().slice(0, 6);
  return (
    <section className="space-y-4 agata-enter" style={{ animationDelay: "0ms" }}>
      <GlassTitlePill title="Moja biblioteka" flourish />
      <div className="relative">
        <div className="shelf agata-shelf agata-shelf-breathe block px-4 pt-10 pb-8 sm:px-6 sm:pt-12 sm:pb-10 min-h-[250px] sm:min-h-[300px] md:min-h-[330px] overflow-hidden">
          <div className="agata-snap-row pr-[84px] sm:pr-[120px] items-end relative z-10">
            {shelfBooks.map((b, i) => (
              <Link
                key={b.id}
                to="/book/$id"
                params={{ id: b.id }}
                className="agata-book-tilt shrink-0 agata-book-rise"
                style={{ animationDelay: `${260 + i * 70}ms` }}
              >
                <BookCover
                  book={b}
                  size="lg"
                  className="!w-[96px] !h-[150px] sm:!w-[124px] sm:!h-[192px] md:!w-[150px] md:!h-[228px]"
                />
              </Link>
            ))}
          </div>
        </div>
        <Link
          to="/add-book"
          aria-label="Dodaj książkę"
          className="agata-plus-button agata-plus-pop absolute right-3 sm:right-5 top-1/2 -translate-y-1/2 w-[56px] h-[56px] sm:w-[72px] sm:h-[72px] rounded-full grid place-items-center hover:scale-[1.04] active:scale-95 transition z-20"
        >
          <Plus className="w-6 h-6 sm:w-8 sm:h-8 gold-text" strokeWidth={2.2} />
        </Link>
      </div>
    </section>
  );
}

function FavouritesSection() {
  const favs = getAllBooks().filter((b) => b.isFavourite).slice(0, 6);
  return (
    <section className="space-y-3.5 agata-enter" style={{ animationDelay: "90ms" }}>
      <SectionTitleBar title="Ulubione" icon={<Heart className="w-4 h-4" />} />
      <SectionPanel>
        {favs.length === 0 ? (
          <EmptySectionNote />
        ) : (
          <div className="agata-snap-row sm:grid sm:grid-cols-3 sm:gap-3 pb-1">
            {favs.map((b) => (
              <FavouriteBookCard key={b.id} book={b} />
            ))}
          </div>
        )}
      </SectionPanel>
    </section>
  );
}

function StatsSection() {
  const all = getAllBooks();
  const sessions = useMemo(() => (typeof window !== "undefined" ? getStoredSessions() : []), []);

  const booksCount = all.length;
  const pagesRead = all.reduce((acc, b) => acc + Math.max(0, Math.min(b.currentPage || 0, b.pageCount || 0)), 0);
  const sessionMinutes = sessions.reduce((acc, s) => acc + (s.minutes || 0), 0);
  const hours = sessionMinutes > 0 ? Math.round(sessionMinutes / 60) : 0;

  // Real per-month pages (current calendar year) from local sessions.
  const monthBars = useMemo(() => {
    const year = new Date().getFullYear();
    const buckets = Array.from({ length: 12 }, () => 0);
    for (const s of sessions) {
      const d = new Date(s.date);
      if (!isNaN(d.getTime()) && d.getFullYear() === year) {
        buckets[d.getMonth()] += s.pagesRead || 0;
      }
    }
    const last6 = buckets.slice(Math.max(0, new Date().getMonth() - 5), new Date().getMonth() + 1);
    const padded = last6.length < 6 ? [...Array(6 - last6.length).fill(0), ...last6] : last6;
    const max = Math.max(1, ...padded);
    return padded.map((v) => Math.round((v / max) * 100));
  }, [sessions]);

  const monthLabels = useMemo(() => {
    const names = ["Sty","Lut","Mar","Kwi","Maj","Cze","Lip","Sie","Wrz","Paź","Lis","Gru"];
    const m = new Date().getMonth();
    const out: string[] = [];
    for (let i = 5; i >= 0; i--) out.push(names[(m - i + 12) % 12]);
    return out;
  }, []);

  const stats = [
    { icon: BookOpen, value: String(booksCount), label: "książek" },
    { icon: FileText, value: pagesRead.toLocaleString("pl-PL"), label: "strony" },
    { icon: Clock, value: hours > 0 ? `${hours} h` : "—", label: "czas czytania" },
  ];
  const hasData = sessions.some((s) => (s.pagesRead || 0) > 0);

  return (
    <section className="space-y-3.5 agata-enter" style={{ animationDelay: "180ms" }}>
      <SectionTitleBar title="Statystyki" icon={<BarChart3 className="w-4 h-4" />} />
      <SectionPanel className="space-y-3.5">
        <div className="grid grid-cols-1 md:grid-cols-[1.4fr_1fr] gap-3">
          <div className="agata-stats-chart p-3.5 sm:p-4">
            <div className="text-[0.82rem] text-warm-muted">Twoje czytanie w tym roku</div>
            <div className="mt-3 h-[88px] flex items-end gap-2 border-b border-[color:color-mix(in_srgb,var(--glass-border)_55%,transparent)] pb-1.5">
              {monthBars.map((v, i) => (
                <div key={i} className="flex-1 flex items-end h-full">
                  <div
                    className="w-full rounded-t-[5px]"
                    style={{
                      height: hasData ? `${Math.max(v, 4)}%` : "4%",
                      background:
                        i === monthBars.length - 1
                          ? "linear-gradient(180deg, color-mix(in srgb, var(--champagne) 92%, white), var(--champagne))"
                          : "linear-gradient(180deg, color-mix(in srgb, var(--champagne) 50%, white), color-mix(in srgb, var(--champagne) 65%, transparent))",
                    }}
                  />
                </div>
              ))}
            </div>
            <div className="mt-1.5 flex gap-2">
              {monthLabels.map((m, i) => (
                <div key={`${m}-${i}`} className="flex-1 text-center text-[0.7rem] text-warm-muted">
                  {m}
                </div>
              ))}
            </div>
            {!hasData && (
              <div className="mt-2 text-[0.72rem] text-warm-muted">Brak danych</div>
            )}
          </div>

          <div className="grid grid-cols-3 gap-2">
            {stats.map((s) => (
              <div
                key={s.label}
                className="agata-stat-box p-2.5 text-center flex flex-col items-center justify-center min-h-[92px]"
              >
                <s.icon className="w-4 h-4 gold-text mb-1.5" />
                <div className="font-serif text-[1.35rem] sm:text-[1.55rem] text-warm leading-none">
                  {s.value}
                </div>
                <div className="text-[0.68rem] sm:text-[0.72rem] text-warm-muted leading-tight mt-1.5 max-w-[10ch]">
                  {s.label}
                </div>
              </div>
            ))}
          </div>
        </div>
        <Link
          to="/statistics"
          className="agata-cta-row px-4 py-3 flex items-center justify-center gap-2 text-[0.95rem] sm:text-[1rem] text-warm hover:bg-[var(--glass-inner)]"
        >
          Zobacz wszystkie statystyki <ArrowRight className="w-4 h-4 gold-text" />
        </Link>
      </SectionPanel>
    </section>
  );
}

function GigiAvatar() {
  return (
    <svg viewBox="0 0 64 80" className="w-[58px] h-[72px] gold-text shrink-0" aria-hidden>
      <g
        fill="none"
        stroke="currentColor"
        strokeWidth="1.15"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
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
  // Lightweight recommender — mirrors /recommendations: author/genre/tag overlap
  // with high-rated, finished, or favourited books. Finished books are excluded.
  const recs = useMemo(() => {
    const all = getAllBooks();
    const signals = all.filter(
      (b) => b.isFavourite || b.status === "finished" || (b.rating ?? 0) >= 8,
    );
    if (signals.length === 0) return [];
    const authorW = new Map<string, number>();
    const genreW = new Map<string, number>();
    const tagW = new Map<string, number>();
    for (const s of signals) {
      const w = ((s.rating ?? 7) - 5) / 2;
      authorW.set(s.author, (authorW.get(s.author) ?? 0) + w);
      if (s.genre) genreW.set(s.genre, (genreW.get(s.genre) ?? 0) + w);
      for (const t of s.tags ?? []) tagW.set(t, (tagW.get(t) ?? 0) + w);
    }
    const scored = all
      .filter((b) => b.status !== "finished")
      .map((b) => {
        let score = 0;
        if (authorW.has(b.author)) score += 5 + (authorW.get(b.author) ?? 0) * 2;
        if (b.genre && genreW.has(b.genre)) score += 3 + (genreW.get(b.genre) ?? 0);
        const shared = (b.tags ?? []).filter((t) => tagW.has(t));
        if (shared.length) score += shared.reduce((acc, t) => acc + 1 + (tagW.get(t) ?? 0) * 0.4, 0);
        return { book: b, score };
      })
      .filter((s) => s.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 2)
      .map((s) => s.book);
    return scored;
  }, []);

  return (
    <section className="space-y-3.5 agata-enter" style={{ animationDelay: "270ms" }}>
      <SectionTitleBar title="Polecane" icon={<Sparkles className="w-4 h-4" />} />
      <SectionPanel>
        <div className="grid grid-cols-1 sm:grid-cols-[0.95fr_1fr_1fr] gap-3 items-stretch">
          <div className="agata-gigi-panel p-4 flex gap-3 items-start">
            <GigiAvatar />
            <div className="flex-1 min-w-0 pt-1">
              <div className="font-serif text-[1.16rem] text-warm flex items-center gap-1.5 leading-none">
                Polecane przez Gigi <Heart className="w-3.5 h-3.5 gold-text" />
              </div>
              <p className="text-[0.88rem] text-warm-muted leading-relaxed mt-3">
                Książki dobrane specjalnie dla Ciebie, na podstawie Twoich preferencji.
              </p>
            </div>
          </div>
          {recs.length === 0 ? (
            <div className="sm:col-span-2">
              <div className="text-sm text-warm-muted px-2 py-3">
                Dodaj i oceń kilka książek, żeby zobaczyć lepsze polecenia.
              </div>
            </div>
          ) : (
            <div className="contents sm:contents">
              {recs.map((b) => (
                <RecommendationPreviewCard key={b.id} book={b} />
              ))}
            </div>
          )}
        </div>
      </SectionPanel>
    </section>
  );
}

function QueueSection() {
  const queue = getAllBooks()
    .filter((b) => b.status === "queue")
    .slice(0, 6);
  return (
    <section className="space-y-3.5 agata-enter" style={{ animationDelay: "360ms" }}>
      <SectionTitleBar title="W kolejce" icon={<Bookmark className="w-4 h-4" />} />
      <SectionPanel>
        {queue.length === 0 ? (
          <EmptySectionNote />
        ) : (
          <div className="agata-snap-row sm:grid sm:grid-cols-3 sm:gap-3 pb-1">
            {queue.map((b) => (
              <QueueBookCard key={b.id} book={b} />
            ))}
          </div>
        )}
      </SectionPanel>
    </section>
  );
}

function HomeMainMenu() {
  useBooksVersion();
  return (
    <div className="px-4 sm:px-6 lg:px-10 agata-safe-bottom max-w-[1120px] mx-auto space-y-5 pt-1 sm:pt-2">
      <BookShelfPreview />
      <FavouritesSection />
      <StatsSection />
      <RecommendationsSection />
      <QueueSection />
    </div>
  );
}
