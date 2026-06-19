import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
// NOTE: mock-data is no longer used as runtime source. getAllBooks() merges
// seed/demo books with locally-added books.
import { getAllNotes, useNotesVersion } from "@/lib/notes-store";
import { getAllBooks, useBooksVersion } from "@/lib/books-store";
import { PageHeader, Chips } from "@/components/PageHeader";
import { readUrlParams, syncUrl } from "@/lib/url-params";
import { Sparkles, Star, Search, X } from "lucide-react";

export const Route = createFileRoute("/quotes")({
  head: () => ({ meta: [{ title: "Cytaty — Agata" }] }),
  component: Quotes,
});

function normalize(s: string) {
  return (s || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

const URL_DEFAULTS = { q: "", bookId: "", tag: "", tab: "Wszystkie" };

function Quotes() {
  const notesVersion = useNotesVersion();
  const booksVersion = useBooksVersion();
  const initial = useRef(readUrlParams(URL_DEFAULTS)).current;
  const [tab, setTab] = useState(initial.tab);
  const [qInput, setQInput] = useState(initial.q);
  const [q, setQ] = useState(initial.q);
  const [bookId, setBookId] = useState(initial.bookId);
  const [tag, setTag] = useState(initial.tag);

  useEffect(() => {
    const t = setTimeout(() => setQ(qInput), 220);
    return () => clearTimeout(t);
  }, [qInput]);

  useEffect(() => {
    syncUrl({ q, bookId, tag, tab }, URL_DEFAULTS);
  }, [q, bookId, tag, tab]);

  const allBooks = useMemo(() => getAllBooks(), [booksVersion]);
  const bookById = useMemo(() => new Map(allBooks.map((b) => [b.id, b])), [allBooks]);

  const allQuotes = useMemo(() => getAllNotes().filter((n) => n.type === "quote"), [notesVersion]);
  const tags = useMemo(() => {
    const set = new Set<string>();
    allQuotes.forEach((n) => n.tags?.forEach((t) => t && set.add(t)));
    return Array.from(set).sort();
  }, [allQuotes]);

  const quotes = useMemo(() => {
    const qn = normalize(q);
    return allQuotes.filter((n) => {
      if (tab === "Ulubione" && !n.isFavourite) return false;
      if (bookId && n.bookId !== bookId) return false;
      if (tag && !n.tags?.includes(tag)) return false;
      if (qn) {
        const hay = normalize(
          [
            n.quoteText,
            n.content,
            n.title,
            ...(n.tags || []),
            bookById.get(n.bookId)?.title,
            bookById.get(n.bookId)?.author,
          ]
            .filter(Boolean)
            .join(" "),
        );
        if (!hay.includes(qn)) return false;
      }
      return true;
    });
  }, [allQuotes, tab, q, bookId, tag, bookById]);

  const hasAnyFilter = Boolean(bookId || tag || q || tab !== "Wszystkie");

  return (
    <div className="overflow-x-clip">
      <PageHeader title="Cytaty" subtitle="Zdania warte zapamiętania." />
      <div className="px-5 lg:px-10 mb-3">
        <div className="relative">
          <Search
            className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground"
            aria-hidden="true"
          />
          <input
            value={qInput}
            onChange={(e) => setQInput(e.target.value)}
            placeholder="Szukaj cytatów, autorów, tagów…"
            aria-label="Szukaj"
            className="w-full bg-card border border-border rounded-full pl-11 pr-10 py-2.5 text-sm focus-visible:outline-2 focus-visible:outline-ring"
          />
          {qInput && (
            <button
              onClick={() => {
                setQInput("");
                setQ("");
              }}
              aria-label="Wyczyść wyszukiwanie"
              className="absolute right-3 top-1/2 -translate-y-1/2 w-7 h-7 grid place-items-center rounded-full hover:bg-muted text-muted-foreground"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>
      <Chips items={["Wszystkie", "Ulubione"]} value={tab} onChange={setTab} />

      <div className="px-5 lg:px-10 mt-3 flex flex-wrap gap-2 text-xs">
        <select
          value={bookId}
          onChange={(e) => setBookId(e.target.value)}
          aria-label="Filtruj wg książki"
          className="bg-card border border-border rounded-full px-3 py-1.5"
        >
          <option value="">Wszystkie książki</option>
          {allBooks.map((b) => (
            <option key={b.id} value={b.id}>
              {b.title}
            </option>
          ))}
        </select>
        <select
          value={tag}
          onChange={(e) => setTag(e.target.value)}
          aria-label="Filtruj wg tagu"
          className="bg-card border border-border rounded-full px-3 py-1.5"
        >
          <option value="">Wszystkie tagi</option>
          {tags.map((t) => (
            <option key={t} value={t}>
              #{t}
            </option>
          ))}
        </select>
        {hasAnyFilter && (
          <button
            onClick={() => {
              setBookId("");
              setTag("");
              setQInput("");
              setQ("");
              setTab("Wszystkie");
            }}
            className="px-3 py-1.5 rounded-full bg-muted"
          >
            Wyczyść filtry
          </button>
        )}
        <span
          className="ml-auto self-center text-muted-foreground"
          role="status"
          aria-live="polite"
          aria-atomic="true"
        >
          {quotes.length > 0 ? `Znaleziono ${quotes.length}` : "Brak wyników"}
        </span>
      </div>

      {tags.length > 0 && (
        <div className="px-5 lg:px-10 mt-3 flex flex-wrap gap-1.5">
          {tags.slice(0, 18).map((t) => {
            const active = t === tag;
            return (
              <button
                key={t}
                onClick={() => setTag(active ? "" : t)}
                aria-pressed={active}
                className={`text-[11px] px-2.5 py-1 rounded-full border transition ${
                  active
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-card border-border hover:bg-muted text-muted-foreground"
                }`}
              >
                #{t}
              </button>
            );
          })}
        </div>
      )}

      <div className="px-5 lg:px-10 mt-4 grid sm:grid-cols-2 gap-4 pb-12">
        {quotes.length === 0 && (
          <div className="text-sm text-muted-foreground">Brak cytatów pasujących do filtrów.</div>
        )}
        {quotes.map((n) => {
          const book = bookById.get(n.bookId);
          return (
            <div key={n.id} className="bg-card rounded-3xl p-6 shadow-soft">
              <blockquote className="font-serif italic text-lg leading-snug">
                „{n.quoteText}"
              </blockquote>
              <div className="mt-3 text-xs text-muted-foreground flex items-center justify-between">
                <span>
                  {book?.title ?? "—"}
                  {n.pageNumber ? ` · s. ${n.pageNumber}` : ""}
                </span>
                {n.isFavourite && (
                  <Star className="w-3.5 h-3.5 fill-rose text-rose" aria-label="Ulubione" />
                )}
              </div>
              {n.tags && n.tags.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-3">
                  {n.tags.map((t) => (
                    <span key={t} className="text-[10px] px-2 py-0.5 rounded-full bg-muted">
                      #{t}
                    </span>
                  ))}
                </div>
              )}
              <Link
                to="/gigi"
                className="mt-4 inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full bg-primary/10 text-primary"
              >
                <Sparkles className="w-3 h-3" aria-hidden="true" />
                Omów z Gigi
              </Link>
            </div>
          );
        })}
      </div>
    </div>
  );
}
