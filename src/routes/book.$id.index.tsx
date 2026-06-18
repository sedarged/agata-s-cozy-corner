import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useState } from "react";
import {
  statusLabel,
  statusToKey,
  bookStatusOptions,
  simpleType,
} from "@/lib/mock-data";
import { getNotesForBook, useNotesVersion } from "@/lib/notes-store";
import {
  getEffectiveBook,
  getCombinedSessionsForBook,
  updateBookState,
  useWorkspaceVersion,
} from "@/lib/book-workspace-store";
import { BookCover } from "@/components/BookCover";
import { deleteBook, updateBook, useBooksVersion, compressCoverFile } from "@/lib/books-store";
import {
  ArrowLeft, Heart, Star, BookOpen, NotebookPen,
  BarChart3, BookmarkCheck, Timer, ChevronRight, Pencil, Trash2, X, Upload,
} from "lucide-react";

export const Route = createFileRoute("/book/$id/")({
  component: BookDashboard,
});

function BookDashboard() {
  useNotesVersion();
  useWorkspaceVersion();
  useBooksVersion();
  const { id } = Route.useParams();
  const book = getEffectiveBook(id);
  const router = useRouter();
  const [ratingOpen, setRatingOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  if (!book) return <BookNotFound />;

  const notes = getNotesForBook(id);
  const sessions = getCombinedSessionsForBook(id);

  const totalMinutes = sessions.reduce((a, s) => a + (s.minutes || 0), 0);
  const totalH = Math.floor(totalMinutes / 60);
  const totalM = totalMinutes % 60;
  const totalPages = book.pageCount ?? 0;
  const currentPage = book.currentPage ?? 0;
  const progress = totalPages > 0
    ? Math.max(0, Math.min(100, Math.round((currentPage / totalPages) * 100)))
    : 0;

  const currentStatus = statusToKey(book.status);
  const quotes = notes.filter(n => simpleType(n.type) === "quote").length;
  const chapters = notes.filter(n => simpleType(n.type) === "chapter").length;
  const others = notes.filter(n => simpleType(n.type) === "other").length;

  const fav = !!book.isFavourite;
  const rating = book.rating ?? 0;
  const opinion = book.opinion ?? "";

  const toggleFav = () => updateBookState(id, { favourite: !fav });

  const goBack = () => {
    if (typeof window !== "undefined" && window.history.length > 1) router.history.back();
    else router.navigate({ to: "/library" });
  };

  return (
    <div className="px-4 sm:px-6 lg:px-10 pb-16">
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
          onClick={toggleFav}
          className="w-10 h-10 grid place-items-center rounded-full glass text-warm hover:bg-[var(--glass-inner)]"
          aria-label="Ulubione"
        >
          <Heart className={`w-4 h-4 ${fav ? "fill-[var(--accent-gold)] text-[var(--accent-gold)]" : "gold-text"}`} />
        </button>
      </div>

      <div className="lg:grid lg:grid-cols-[340px_1fr] lg:gap-8">
        <div className="space-y-4">
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
                    i < Math.round(rating / 2)
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

          <div className="flex gap-2">
            <button onClick={() => setEditOpen(true)} className="flex-1 inline-flex items-center justify-center gap-2 py-2.5 rounded-full glass text-warm text-sm">
              <Pencil className="w-4 h-4 gold-text" /> Edytuj książkę
            </button>
            <button onClick={() => setConfirmDelete(true)} className="flex-1 inline-flex items-center justify-center gap-2 py-2.5 rounded-full glass text-warm text-sm">
              <Trash2 className="w-4 h-4 gold-text" /> Usuń książkę
            </button>
          </div>
        </div>

        <div className="space-y-4 mt-4 lg:mt-0 min-w-0">
          <PreviewCard title="O książce" to="/book/$id/about" id={id} cta="Zobacz szczegóły">
            <p className="text-sm text-warm-muted line-clamp-3">{book.description || "Brak danych"}</p>
            <dl className="grid grid-cols-2 gap-x-4 gap-y-2 mt-4 text-sm">
              <Field label="Autor" value={book.author} />
              <Field label="Liczba stron" value={book.pageCount} />
              <Field label="Gatunek" value={book.genre} />
              <Field label="Wydawnictwo" value={(book as { publisher?: string }).publisher} />
              <Field label="Data wydania" value={book.publishedDate} />
            </dl>
          </PreviewCard>

          <section className="glass rounded-[24px] p-5">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-serif text-lg">Moja ocena</h2>
              <button
                onClick={() => setRatingOpen(o => !o)}
                className="text-xs text-warm hover:text-[var(--accent-gold)] inline-flex items-center gap-1"
              >
                {ratingOpen ? "Zamknij" : "Edytuj"} <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
            {!ratingOpen ? (
              <>
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-1">
                    {[...Array(5)].map((_, i) => (
                      <Star
                        key={i}
                        className={`w-4 h-4 ${
                          i < Math.round(rating / 2)
                            ? "fill-[var(--accent-gold)] text-[var(--accent-gold)]"
                            : "text-warm-muted"
                        }`}
                      />
                    ))}
                  </div>
                  <Heart className={`w-4 h-4 ${fav ? "fill-[var(--accent-gold)] text-[var(--accent-gold)]" : "gold-text"}`} />
                </div>
                <p className="text-sm text-warm-muted mt-3 whitespace-pre-wrap">
                  {opinion || "Twoja prywatna opinia o tej książce."}
                </p>
              </>
            ) : (
              <RatingEditor
                bookId={id}
                initialRating={rating}
                initialFav={fav}
                initialOpinion={opinion}
                onClose={() => setRatingOpen(false)}
              />
            )}
          </section>

          <PreviewCard title="Notatki" to="/book/$id/notes" id={id} cta="Przejdź do notatek">
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
          </PreviewCard>

          <PreviewCard title="Statystyki" to="/book/$id/stats" id={id} cta="Zobacz statystyki">
            <div className="grid grid-cols-3 gap-2 text-center">
              <Tile n={`${currentPage}/${totalPages}`} l="Przeczytane strony" />
              <Tile n={`${progress}%`} l="Postęp" />
              <Tile n={totalH > 0 ? `${totalH}g ${totalM}m` : `${totalM}m`} l="Czas czytania" />
            </div>
            <div className="mt-3 h-1.5 bg-[var(--glass-inner)] rounded-full overflow-hidden">
              <div className="h-full bg-[var(--accent-gold)]" style={{ width: `${progress}%` }} />
            </div>
          </PreviewCard>

          <PreviewCard title="Stan" to="/book/$id/status" id={id} cta="Zmień stan">
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

      {editOpen && (
        <EditBookModal
          bookId={id}
          initial={book}
          onClose={() => setEditOpen(false)}
        />
      )}
      {confirmDelete && (
        <ConfirmDeleteModal
          onCancel={() => setConfirmDelete(false)}
          onConfirm={() => {
            deleteBook(id);
            router.navigate({ to: "/library" });
          }}
        />
      )}
    </div>
  );
}

interface EditableBook {
  title: string; author: string; isbn: string; description: string;
  pageCount: number; publishedDate: string; genre: string; cover_url?: string | null;
  publisher?: string; seriesName?: string; seriesPart?: string; tags: string[];
}

function EditBookModal({ bookId, initial, onClose }: { bookId: string; initial: EditableBook; onClose: () => void }) {
  const [title, setTitle] = useState(initial.title);
  const [author, setAuthor] = useState(initial.author);
  const [isbn, setIsbn] = useState(initial.isbn || "");
  const [description, setDescription] = useState(initial.description || "");
  const [pageCount, setPageCount] = useState(String(initial.pageCount || ""));
  const [publishedDate, setPublishedDate] = useState(initial.publishedDate || "");
  const [genre, setGenre] = useState(initial.genre || "");
  const [publisher, setPublisher] = useState(initial.publisher || "");
  const [seriesName, setSeriesName] = useState(initial.seriesName || "");
  const [seriesPart, setSeriesPart] = useState(initial.seriesPart || "");
  const [tags, setTags] = useState((initial.tags || []).join(", "));
  const [coverUrl, setCoverUrl] = useState(typeof initial.cover_url === "string" ? initial.cover_url : "");
  const [error, setError] = useState<string | null>(null);

  const onFile = async (f: File) => {
    try {
      const r = await compressCoverFile(f);
      setCoverUrl(r.dataUrl);
    } catch {
      setError("Nie udało się dodać okładki. Spróbuj wybrać mniejszy plik.");
    }
  };

  const save = () => {
    if (!title.trim()) { setError("Tytuł jest wymagany"); return; }
    if (!author.trim()) { setError("Autor jest wymagany"); return; }
    const res = updateBook(bookId, {
      title, author, isbn, description, genre, publishedDate,
      pageCount: Number(pageCount) || 0,
      cover_url: coverUrl || null,
      publisher, seriesName, seriesPart,
      tags: tags.split(",").map(t => t.trim()).filter(Boolean),
    });
    if (!res.ok) { setError(res.error || "Nie udało się zapisać zmian."); return; }
    onClose();
  };

  const inp = "w-full bg-[var(--glass-inner)] rounded-xl px-3.5 py-2.5 text-sm text-warm focus:outline-none";
  return (
    <div className="fixed inset-0 z-50 bg-black/40 grid place-items-end sm:place-items-center p-2 sm:p-6 overflow-y-auto">
      <div className="glass rounded-3xl w-full max-w-lg p-5 space-y-3 max-h-[92vh] overflow-y-auto">
        <div className="flex items-center justify-between">
          <h2 className="font-serif text-xl text-warm">Edytuj książkę</h2>
          <button onClick={onClose} className="w-9 h-9 grid place-items-center rounded-full glass"><X className="w-4 h-4" /></button>
        </div>
        <label className="block"><span className="text-[11px] uppercase tracking-wider text-warm-muted">Tytuł</span><input value={title} onChange={e=>setTitle(e.target.value)} className={inp} /></label>
        <label className="block"><span className="text-[11px] uppercase tracking-wider text-warm-muted">Autor</span><input value={author} onChange={e=>setAuthor(e.target.value)} className={inp} /></label>
        <label className="block"><span className="text-[11px] uppercase tracking-wider text-warm-muted">ISBN</span><input value={isbn} onChange={e=>setIsbn(e.target.value)} className={inp} /></label>
        <label className="block"><span className="text-[11px] uppercase tracking-wider text-warm-muted">Opis</span><textarea value={description} onChange={e=>setDescription(e.target.value)} rows={3} className={inp} /></label>
        <div className="grid grid-cols-2 gap-3">
          <label className="block"><span className="text-[11px] uppercase tracking-wider text-warm-muted">Liczba stron</span><input value={pageCount} onChange={e=>setPageCount(e.target.value)} inputMode="numeric" className={inp} /></label>
          <label className="block"><span className="text-[11px] uppercase tracking-wider text-warm-muted">Data wydania</span><input value={publishedDate} onChange={e=>setPublishedDate(e.target.value)} className={inp} /></label>
        </div>
        <label className="block"><span className="text-[11px] uppercase tracking-wider text-warm-muted">Gatunek</span><input value={genre} onChange={e=>setGenre(e.target.value)} className={inp} /></label>
        <label className="block"><span className="text-[11px] uppercase tracking-wider text-warm-muted">Wydawnictwo</span><input value={publisher} onChange={e=>setPublisher(e.target.value)} className={inp} /></label>
        <div className="grid grid-cols-2 gap-3">
          <label className="block"><span className="text-[11px] uppercase tracking-wider text-warm-muted">Seria</span><input value={seriesName} onChange={e=>setSeriesName(e.target.value)} className={inp} /></label>
          <label className="block"><span className="text-[11px] uppercase tracking-wider text-warm-muted">Część serii</span><input value={seriesPart} onChange={e=>setSeriesPart(e.target.value)} className={inp} /></label>
        </div>
        <label className="block"><span className="text-[11px] uppercase tracking-wider text-warm-muted">Tagi</span><input value={tags} onChange={e=>setTags(e.target.value)} className={inp} /></label>
        <div>
          <span className="text-[11px] uppercase tracking-wider text-warm-muted">Okładka</span>
          <input value={coverUrl} onChange={e=>setCoverUrl(e.target.value)} placeholder="URL okładki" className={inp + " mt-1"} />
          <label className="mt-2 inline-flex items-center gap-2 px-3 py-2 rounded-xl glass text-warm text-sm cursor-pointer w-fit">
            <Upload className="w-4 h-4" /> Dodaj własną okładkę
            <input type="file" accept="image/*" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) onFile(f); }} />
          </label>
        </div>
        {error && <div className="text-sm text-rose-500">{error}</div>}
        <div className="flex gap-2 pt-2">
          <button onClick={save} className="flex-1 py-2.5 rounded-full bg-[var(--accent-gold)] text-[var(--bg)] text-sm font-medium">Zapisz</button>
          <button onClick={onClose} className="flex-1 py-2.5 rounded-full glass text-warm text-sm">Anuluj</button>
        </div>
      </div>
    </div>
  );
}

function ConfirmDeleteModal({ onCancel, onConfirm }: { onCancel: () => void; onConfirm: () => void }) {
  return (
    <div className="fixed inset-0 z-50 bg-black/40 grid place-items-center p-4">
      <div className="glass rounded-3xl w-full max-w-sm p-5 space-y-3">
        <h2 className="font-serif text-xl text-warm">Usunąć książkę?</h2>
        <p className="text-sm text-warm-muted">
          Książka zostanie usunięta tylko z tego urządzenia. Notatki i sesje czytania dla tej książki pozostaną zapisane lokalnie, ale nie będą widoczne bez książki.
        </p>
        <div className="flex gap-2 pt-2">
          <button onClick={onCancel} className="flex-1 py-2.5 rounded-full glass text-warm text-sm">Anuluj</button>
          <button onClick={onConfirm} className="flex-1 py-2.5 rounded-full bg-[var(--accent-gold)] text-[var(--bg)] text-sm font-medium">Usuń</button>
        </div>
      </div>
    </div>
  );
}

function RatingEditor({
  bookId, initialRating, initialFav, initialOpinion, onClose,
}: { bookId: string; initialRating: number; initialFav: boolean; initialOpinion: string; onClose: () => void }) {
  const [stars, setStars] = useState(Math.round(initialRating / 2));
  const [fav, setFav] = useState(initialFav);
  const [opinion, setOpinion] = useState(initialOpinion);

  const onSave = () => {
    updateBookState(bookId, { rating: stars * 2, favourite: fav, opinion });
    onClose();
  };

  return (
    <div className="space-y-3">
      <div>
        <div className="text-[11px] uppercase tracking-wider text-warm-muted mb-1.5">Ocena</div>
        <div className="flex items-center gap-1">
          {[1, 2, 3, 4, 5].map(i => (
            <button
              key={i}
              type="button"
              onClick={() => setStars(stars === i ? 0 : i)}
              aria-label={`${i} z 5`}
            >
              <Star className={`w-6 h-6 ${i <= stars ? "fill-[var(--accent-gold)] text-[var(--accent-gold)]" : "text-warm-muted"}`} />
            </button>
          ))}
        </div>
      </div>
      <label className="inline-flex items-center gap-2 text-sm text-warm">
        <input type="checkbox" checked={fav} onChange={e => setFav(e.target.checked)} className="accent-[var(--accent-gold)]" />
        Ulubiona
      </label>
      <div>
        <div className="text-[11px] uppercase tracking-wider text-warm-muted mb-1.5">Prywatna opinia</div>
        <textarea
          value={opinion}
          onChange={e => setOpinion(e.target.value)}
          rows={4}
          className="w-full bg-[var(--glass-inner)] rounded-xl p-3 text-sm focus:outline-none"
        />
      </div>
      <div className="flex gap-2">
        <button onClick={onSave} className="flex-1 py-2.5 rounded-full bg-[var(--accent-gold)] text-[var(--bg)] text-sm font-medium">
          Zapisz ocenę
        </button>
        <button onClick={onClose} className="flex-1 py-2.5 rounded-full glass text-warm text-sm">
          Anuluj
        </button>
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
        ) : null
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

export function BookNotFound() {
  return (
    <div className="px-5 lg:px-10 pt-16 pb-20 flex flex-col items-center text-center">
      <div className="glass rounded-[28px] p-10 max-w-md w-full">
        <h1 className="font-serif text-2xl mb-3">Nie znaleziono książki</h1>
        <p className="text-sm text-warm-muted mb-6">Ta książka mogła zostać usunięta lub identyfikator jest nieprawidłowy.</p>
        <Link to="/library" className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-[var(--accent-gold)] text-[var(--bg)] text-sm">
          Wróć do biblioteki
        </Link>
      </div>
    </div>
  );
}
