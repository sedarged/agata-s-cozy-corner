import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useState } from "react";
import {
  getBookById,
  calculateBookStats,
  statusLabel,
  statusToKey,
  bookStatusOptions,
  simpleType,
} from "@/lib/mock-data";
import { getNotesForBook, useNotesVersion } from "@/lib/notes-store";
import { BookCover } from "@/components/BookCover";
import {
  ArrowLeft, Heart, Star, BookOpen, NotebookPen,
  BarChart3, BookmarkCheck, Timer, ChevronRight,
} from "lucide-react";

export const Route = createFileRoute("/book/$id/")({
  component: BookDashboard,
});

function BookDashboard() {
  useNotesVersion();
  const { id } = Route.useParams();
  const book = getBookById(id)!;
  const notes = getNotesForBook(id);
  const stats = calculateBookStats(id);
  const router = useRouter();
  const [fav, setFav] = useState(book.isFavourite);

  const currentStatus = statusToKey(book.status);
  const quotes = notes.filter(n => n.type === "quote").length;
  const chapters = notes.filter(n => n.type === "chapter").length;
  const others = notes.filter(n => n.type === "other" || n.type === "note").length;
  const totalH = Math.floor(stats.totalMinutes / 60);
  const totalM = stats.totalMinutes % 60;

  const goBack = () => {
    if (typeof window !== "undefined" && window.history.length > 1) router.history.back();
    else router.navigate({ to: "/library" });
  };

  return (
    <div className="px-4 sm:px-6 lg:px-10 pb-16">
      {/* Top row */}
      <div className="flex items-center justify-between pt-2 pb-3">
        <button
          onClick={goBack}
          className="w-10 h-10 grid place-items-center rounded-full glass text-warm hover:bg-[var(--glass-inner)]"
          aria-label="Wróć"
        >
          <ArrowLeft className="w-4 h-4 gold-text" />
        </button>
        <span className="text-[11px] uppercase tracking-[0.24em] text-warm-muted">Szczegóły książki</span>
        <button
          onClick={() => setFav(f => !f)}
          className="w-10 h-10 grid place-items-center rounded-full glass text-warm hover:bg-[var(--glass-inner)]"
          aria-label="Ulubione"
        >
          <Heart className={`w-4 h-4 ${fav ? "fill-[var(--accent-gold)] text-[var(--accent-gold)]" : "gold-text"}`} />
        </button>
      </div>

      <div className="lg:grid lg:grid-cols-[340px_1fr] lg:gap-8">
        {/* Left column */}
        <div className="space-y-4">
          {/* Hero card */}
          <div className="glass rounded-[28px] p-5 text-center">
            <div className="flex justify-center">
              <BookCover book={book} size="xl" />
            </div>
            <h1 className="font-serif text-2xl leading-tight mt-5">{book.title}</h1>
            <div className="text-sm text-warm-muted mt-1">{book.author}</div>
            <div className="mt-3 inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[var(--glass-inner)] text-xs text-warm">
              <BookmarkCheck className="w-3.5 h-3.5 gold-text" />
              {statusLabel(book.status)}
            </div>
            <div className="flex items-center justify-center gap-1 mt-3">
              {[...Array(5)].map((_, i) => (
                <Star
                  key={i}
                  className={`w-4 h-4 ${
                    i < Math.round((book.rating ?? 0) / 2)
                      ? "fill-[var(--accent-gold)] text-[var(--accent-gold)]"
                      : "text-warm-muted"
                  }`}
                />
              ))}
            </div>
            <Link
              to="/book/$id/read"
              params={{ id }}
              className="mt-5 inline-flex items-center justify-center gap-2 w-full py-3 rounded-full bg-[var(--accent-gold)] text-[var(--bg)] font-medium"
            >
              <Timer className="w-4 h-4" /> Czytaj
            </Link>
          </div>

          {/* Quick actions */}
          <div className="grid grid-cols-2 gap-2.5">
            {[
              { to: "/book/$id/about", label: "O książce", icon: BookOpen },
              { to: "/book/$id/notes", label: "Notatki", icon: NotebookPen },
              { to: "/book/$id/stats", label: "Statystyki", icon: BarChart3 },
              { to: "/book/$id/status", label: "Stan", icon: BookmarkCheck },
            ].map(a => (
              <Link
                key={a.to}
                to={a.to as "/book/$id/about"}
                params={{ id }}
                className="glass rounded-2xl p-3.5 flex items-center gap-3 text-sm text-warm hover:bg-[var(--glass-inner)] transition"
              >
                <a.icon className="w-4 h-4 gold-text" />
                {a.label}
              </Link>
            ))}
          </div>
        </div>

        {/* Right column — preview cards */}
        <div className="space-y-4 mt-4 lg:mt-0 min-w-0">
          <PreviewCard
            title="O książce"
            to="/book/$id/about"
            id={id}
            cta="Zobacz szczegóły"
          >
            <p className="text-sm text-warm-muted line-clamp-3">
              {book.description || "Brak danych"}
            </p>
            <dl className="grid grid-cols-2 gap-x-4 gap-y-2 mt-4 text-sm">
              <Field label="Autor" value={book.author} />
              <Field label="Liczba stron" value={book.pageCount} />
              <Field label="Gatunek" value={book.genre} />
              <Field label="Wydawnictwo" value={(book as { publisher?: string }).publisher} />
              <Field label="Data wydania" value={book.publishedDate} />
            </dl>
          </PreviewCard>

          <PreviewCard title="Moja ocena" cta="Edytuj ocenę">
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1">
                {[...Array(5)].map((_, i) => (
                  <Star
                    key={i}
                    className={`w-4 h-4 ${
                      i < Math.round((book.rating ?? 0) / 2)
                        ? "fill-[var(--accent-gold)] text-[var(--accent-gold)]"
                        : "text-warm-muted"
                    }`}
                  />
                ))}
              </div>
              <Heart className={`w-4 h-4 ${fav ? "fill-[var(--accent-gold)] text-[var(--accent-gold)]" : "gold-text"}`} />
            </div>
            <p className="text-sm text-warm-muted mt-3">Twoja prywatna opinia o tej książce.</p>
          </PreviewCard>

          <PreviewCard
            title="Notatki"
            to="/book/$id/notes"
            id={id}
            cta="Przejdź do notatek"
          >
            <div className="grid grid-cols-4 gap-2 text-center">
              <Tile n={notes.length} l="Łącznie" />
              <Tile n={quotes} l="Cytaty" />
              <Tile n={chapters} l="Rozdziały" />
              <Tile n={others} l="Inne" />
            </div>
            {notes.length > 0 && (
              <div className="mt-4 space-y-2">
                {notes.slice(0, 2).map(n => (
                  <div key={n.id} className="p-3 rounded-xl bg-[var(--glass-inner)]">
                    <div className="text-[10px] uppercase tracking-widest text-warm-muted">
                      {n.type === "quote" ? "Cytat" : n.type === "chapter" ? "Rozdział" : "Inne"}
                      {n.pageNumber ? ` · s. ${n.pageNumber}` : ""}
                    </div>
                    <div className="text-sm text-warm mt-1 line-clamp-2">
                      {n.quoteText || n.content || n.title || "Brak danych"}
                    </div>
                  </div>
                ))}
              </div>
            )}
            <p className="text-sm text-warm-muted mt-3">
              Cytaty, rozdziały i własne przemyślenia w jednym miejscu.
            </p>
          </PreviewCard>

          <PreviewCard
            title="Statystyki"
            to="/book/$id/stats"
            id={id}
            cta="Zobacz statystyki"
          >
            <div className="grid grid-cols-3 gap-2 text-center">
              <Tile n={`${stats.currentPage}/${stats.totalPages}`} l="Przeczytane strony" />
              <Tile n={`${stats.progress}%`} l="Postęp" />
              <Tile n={totalH > 0 ? `${totalH}g ${totalM}m` : `${totalM}m`} l="Czas czytania" />
            </div>
            <div className="mt-3 h-1.5 bg-[var(--glass-inner)] rounded-full overflow-hidden">
              <div className="h-full bg-[var(--accent-gold)]" style={{ width: `${stats.progress}%` }} />
            </div>
          </PreviewCard>

          <PreviewCard
            title="Stan"
            to="/book/$id/status"
            id={id}
            cta="Zmień stan"
          >
            <div className="flex flex-wrap gap-2">
              {bookStatusOptions.map(o => {
                const active = o.value === currentStatus;
                return (
                  <span
                    key={o.value}
                    className={`px-3 py-1.5 rounded-full text-xs border ${
                      active
                        ? "bg-[var(--accent-gold)] text-[var(--bg)] border-[var(--accent-gold)]"
                        : "border-[var(--glass-border)] text-warm-muted"
                    }`}
                  >
                    {o.label}
                  </span>
                );
              })}
            </div>
          </PreviewCard>
        </div>
      </div>
    </div>
  );
}

function PreviewCard({
  title, to, id, cta, children,
}: {
  title: string;
  to?: string;
  id?: string;
  cta?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="glass rounded-[24px] p-5">
      <h2 className="font-serif text-lg mb-3">{title}</h2>
      {children}
      {cta && (
        to && id ? (
          <Link
            to={to as "/book/$id/about"}
            params={{ id }}
            className="mt-4 inline-flex items-center gap-1.5 text-xs text-warm hover:text-[var(--accent-gold)] transition"
          >
            {cta} <ChevronRight className="w-3.5 h-3.5" />
          </Link>
        ) : (
          <button
            type="button"
            className="mt-4 inline-flex items-center gap-1.5 text-xs text-warm hover:text-[var(--accent-gold)] transition"
          >
            {cta} <ChevronRight className="w-3.5 h-3.5" />
          </button>
        )
      )}
    </section>
  );
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-[10px] uppercase tracking-widest text-warm-muted">{label}</dt>
      <dd className="text-sm text-warm truncate">{value ?? "Brak danych"}</dd>
    </div>
  );
}

function Tile({ n, l }: { n: React.ReactNode; l: string }) {
  return (
    <div className="p-3 rounded-xl bg-[var(--glass-inner)]">
      <div className="font-serif text-lg leading-none">{n}</div>
      <div className="text-[10px] uppercase tracking-widest text-warm-muted mt-1">{l}</div>
    </div>
  );
}
