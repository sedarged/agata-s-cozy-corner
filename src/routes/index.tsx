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

function GlassTitlePill({ title, icon, flourish }: { title: string; icon?: ReactNode; flourish?: boolean }) {
  return (
    <div className="agata-title-pill px-7 py-3.5 sm:py-4 flex items-center justify-center relative">
      {flourish && (
        <svg className="absolute left-6 gold-text opacity-80" width="28" height="12" viewBox="0 0 28 12" aria-hidden>
          <path d="M1 6 Q 7 1 13 6 T 27 6" stroke="currentColor" strokeWidth="0.8" fill="none" />
          <circle cx="3.5" cy="6" r="1" fill="currentColor" />
        </svg>
      )}
      <h2 className="font-serif text-[1.9rem] sm:text-[2.25rem] text-warm tracking-[0.01em] leading-none">{title}</h2>
      {flourish && (
        <svg className="absolute right-6 gold-text opacity-80 scale-x-[-1]" width="28" height="12" viewBox="0 0 28 12" aria-hidden>
          <path d="M1 6 Q 7 1 13 6 T 27 6" stroke="currentColor" strokeWidth="0.8" fill="none" />
          <circle cx="3.5" cy="6" r="1" fill="currentColor" />
        </svg>
      )}
      {icon && <span className="absolute right-5 gold-text">{icon}</span>}
    </div>
  );
}

function SectionTitleBar({ title, icon }: { title: string; icon: ReactNode }) {
  return (
    <div className="agata-section-title px-5 py-2.5 sm:py-3 flex items-center justify-between">
      <h2 className="font-serif text-[1.8rem] sm:text-[2rem] text-warm leading-none">{title}</h2>
      <span className="gold-text">{icon}</span>
    </div>
  );
}

function SectionPanel({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("agata-section-panel p-4 sm:p-4.5", className)}>{children}</div>;
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

function FavouriteBookCard({ bookId }: { bookId: string }) {
  const book = books.find((b) => b.id === bookId)!;
  return (
    <Link
      to="/book/$id"
      params={{ id: book.id }}
      className="agata-inline-card p-3 min-w-[236px] sm:min-w-0 flex items-center gap-3 hover:translate-y-[-1px] transition"
    >
      <BookCover book={book} size="sm" className="!w-[76px] !h-[112px] sm:!w-[84px] sm:!h-[122px]" />
      <div className="flex-1 min-w-0 self-stretch flex flex-col justify-center pr-7 relative">
        <div className="font-serif text-[1rem] sm:text-[1.08rem] text-warm leading-[1.02] line-clamp-2">{book.title}</div>
        <div className="text-[0.78rem] sm:text-[0.8rem] text-warm-muted mt-1 line-clamp-1">{book.author}</div>
        <div className="mt-3"><Stars value={5} /></div>
        <Heart className="absolute right-0 bottom-1 w-4 h-4 gold-text" />
      </div>
    </Link>
  );
}

function QueueBookCard({ bookId }: { bookId: string }) {
  const book = books.find((b) => b.id === bookId)!;
  return (
    <Link
      to="/book/$id"
      params={{ id: book.id }}
      className="agata-inline-card p-3 min-w-[236px] sm:min-w-0 flex items-center gap-3 hover:translate-y-[-1px] transition"
    >
      <BookCover book={book} size="sm" className="!w-[76px] !h-[112px] sm:!w-[84px] sm:!h-[122px]" />
      <div className="flex-1 min-w-0 self-stretch flex flex-col justify-center">
        <div className="font-serif text-[0.98rem] sm:text-[1rem] text-warm leading-[1.04] line-clamp-2">{book.title}</div>
        <div className="text-[0.78rem] sm:text-[0.8rem] text-warm-muted mt-1 line-clamp-1">{book.author}</div>
        <div className="mt-3 flex items-center gap-1.5 text-[0.76rem] text-warm-muted">
          <Calendar className="w-3.5 h-3.5 gold-text" /> Planowana
        </div>
      </div>
    </Link>
  );
}

function RecommendationPreviewCard({ bookId }: { bookId: string }) {
  const book = books.find((b) => b.id === bookId)!;
  return (
    <div className="agata-reco-card p-3.5 flex items-center gap-4 min-w-[250px] sm:min-w-0">
      <BookCover book={book} size="sm" className="!w-[82px] !h-[118px] sm:!w-[90px] sm:!h-[128px]" />
      <div className="flex-1 min-w-0">
        <div className="font-serif text-[1rem] sm:text-[1.1rem] text-warm leading-[1.04] line-clamp-2">{book.title}</div>
        <div className="text-[0.8rem] sm:text-[0.84rem] text-warm-muted mt-1">{book.author}</div>
        <div className="mt-3"><Stars value={4} /></div>
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

function BookShelfPreview() {
  const shelfBooks = books.slice(0, 5);
  return (
    <section className="space-y-4">
      <GlassTitlePill title="Moja biblioteka" flourish />
      <div className="relative">
        <Link to="/library" className="shelf agata-shelf block px-4 pt-10 pb-7 sm:px-8 sm:pt-12 sm:pb-8">
          <div className="flex items-end gap-4 sm:gap-5 overflow-x-auto no-scrollbar pr-20 sm:pr-22">
            {shelfBooks.map((b) => (
              <Link
                key={b.id}
                to="/book/$id"
                params={{ id: b.id }}
                onClick={(e) => e.stopPropagation()}
                className="shrink-0 hover:-translate-y-1 transition"
              >
                <BookCover book={b} size="lg" className="!w-[108px] !h-[160px] sm:!w-[164px] sm:!h-[246px]" />
              </Link>
            ))}
          </div>
        </Link>
        <Link
          to="/add-book"
          aria-label="Dodaj książkę"
          className="agata-plus-button absolute right-2 sm:right-6 bottom-3 sm:bottom-5 w-[74px] h-[74px] sm:w-[108px] sm:h-[108px] rounded-full grid place-items-center hover:scale-[1.02] active:scale-95 transition"
        >
          <Plus className="w-7 h-7 sm:w-10 sm:h-10 text-white" strokeWidth={2.15} />
        </Link>
      </div>
    </section>
  );
}

function FavouritesSection() {
  const favs = ["3", "4", "2"];
  return (
    <section className="space-y-3.5">
      <SectionTitleBar title="Ulubione" icon={<Heart className="w-4 h-4" />} />
      <SectionPanel>
        <div className="flex gap-3 overflow-x-auto no-scrollbar pb-1 sm:grid sm:grid-cols-3 sm:gap-3">
          {favs.map((id) => <FavouriteBookCard key={id} bookId={id} />)}
        </div>
      </SectionPanel>
    </section>
  );
}

function StatsSection() {
  const monthBars = [34, 52, 51, 66, 94, 50];
  const months = ["Sty", "Lut", "Mar", "Kwi", "Maj", "Cze"];
  return (
    <section className="space-y-3.5">
      <SectionTitleBar title="Statystyki" icon={<BarChart3 className="w-4 h-4" />} />
      <SectionPanel className="space-y-3.5">
        <div className="grid grid-cols-1 md:grid-cols-[1.35fr_0.7fr_0.7fr_0.7fr] gap-3">
          <div className="agata-stats-chart p-4 sm:p-5">
            <div className="text-[0.86rem] text-warm-muted">Twoje czytanie w tym roku</div>
            <div className="mt-5 h-[128px] flex items-end gap-3 border-b border-[color:color-mix(in_srgb,var(--glass-border)_55%,transparent)] pb-2">
              {monthBars.map((v, i) => (
                <div key={i} className="flex-1 flex items-end h-full">
                  <div
                    className="w-full rounded-t-[6px]"
                    style={{
                      height: `${v}%`,
                      background: i === 4
                        ? "linear-gradient(180deg, color-mix(in srgb, var(--accent-gold) 92%, white), var(--accent-gold))"
                        : "linear-gradient(180deg, color-mix(in srgb, var(--accent-gold) 45%, white), color-mix(in srgb, var(--accent-gold) 65%, transparent))",
                    }}
                  />
                </div>
              ))}
            </div>
            <div className="mt-2 flex gap-3">
              {months.map((m) => (
                <div key={m} className="flex-1 text-center text-[0.78rem] text-warm-muted">{m}</div>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3 md:contents">
            {[
              { icon: BookOpen, value: "18", label: "książek przeczytanych" },
            { icon: FileText, value: "5 362", label: "strony" },
            { icon: Clock, value: "142 h", label: "czas czytania" },
          ].map((s) => (
            <div key={s.label} className="agata-stat-box p-4 text-center flex flex-col items-center justify-center min-h-[136px]">
              <s.icon className="w-4 h-4 gold-text mb-3" />
              <div className="font-serif text-[2.1rem] text-warm leading-none">{s.value}</div>
              <div className="text-[0.82rem] text-warm-muted leading-tight mt-2 max-w-[8ch]">{s.label}</div>
            </div>
          ))}
        </div>
        <Link to="/statistics" className="agata-cta-row px-4 py-3 flex items-center justify-center gap-2 text-[1rem] text-warm hover:bg-[var(--glass-inner)]">
          Zobacz wszystkie statystyki <ArrowRight className="w-4 h-4 gold-text" />
        </Link>
      </SectionPanel>
    </section>
  );
}

function GigiAvatar() {
  return (
    <svg viewBox="0 0 64 80" className="w-[58px] h-[72px] gold-text" aria-hidden>
      <g fill="none" stroke="currentColor" strokeWidth="1.15" strokeLinecap="round" strokeLinejoin="round">
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
  return (
    <section className="space-y-3.5">
      <SectionTitleBar title="Polecane" icon={<Sparkles className="w-4 h-4" />} />
      <SectionPanel>
        <div className="grid grid-cols-1 sm:grid-cols-[1.05fr_0.95fr_0.95fr] gap-3 items-stretch">
          <div className="agata-gigi-panel p-4 flex gap-3 items-start">
            <GigiAvatar />
            <div className="flex-1 min-w-0 pt-1">
              <div className="font-serif text-[1.24rem] text-warm flex items-center gap-1.5 leading-none">
                Polecane przez Gigi <Heart className="w-3.5 h-3.5 gold-text" />
              </div>
              <p className="text-[0.92rem] text-warm-muted leading-relaxed mt-3 max-w-[19ch]">
                Książki dobrane specjalnie dla Ciebie, na podstawie Twoich preferencji.
              </p>
            </div>
          </div>
          <RecommendationPreviewCard bookId="6" />
          <RecommendationPreviewCard bookId="7" />
        </div>
      </SectionPanel>
    </section>
  );
}

function QueueSection() {
  const queue = ["8", "9", "10"];
  return (
    <section className="space-y-3.5">
      <SectionTitleBar title="W kolejce" icon={<Bookmark className="w-4 h-4" />} />
      <SectionPanel>
        <div className="flex gap-3 overflow-x-auto no-scrollbar pb-1 sm:grid sm:grid-cols-3 sm:gap-3">
          {queue.map((id) => <QueueBookCard key={id} bookId={id} />)}
        </div>
      </SectionPanel>
    </section>
  );
}

function HomeMainMenu() {
  return (
    <div className="px-4 sm:px-6 lg:px-10 pb-16 max-w-[1120px] mx-auto space-y-5 pt-1 sm:pt-2">
      <BookShelfPreview />
      <FavouritesSection />
      <StatsSection />
      <RecommendationsSection />
      <QueueSection />
    </div>
  );
}
