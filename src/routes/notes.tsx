import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useBooksQuery, useNotesQuery } from "@/lib/api/client";
import { PageHeader, Chips } from "@/components/PageHeader";
import { readUrlParams, syncUrl } from "@/lib/url-params";
import { foldText as normalize, pluralPL, formatDatePL } from "@/lib/utils";
import {
  Search,
  Star,
  Camera,
  Quote as QuoteIcon,
  FileText,
  ListTree,
  Plus,
  X,
} from "lucide-react";

export const Route = createFileRoute("/notes")({
  head: () => ({ meta: [{ title: "Notatki — Agata" }] }),
  component: NotesPage,
});

const typeMap = {
  Cytaty: "quote",
  Rozdziały: "chapter",
  "Zdjęcia stron": "page-photo",
  Inne: "other",
} as const;
const typeLabel: Record<string, string> = {
  quote: "cytat",
  note: "notatka",
  "page-photo": "zdjęcie strony",
  chapter: "rozdział",
  other: "inne",
};

const URL_DEFAULTS = { q: "", bookId: "", tag: "", filter: "Wszystkie", sort: "newest" };

function NotesPage() {
  const { data: allNotes = [] } = useNotesQuery();
  const { data: allBooks = [] } = useBooksQuery();
  const initial = useRef(readUrlParams(URL_DEFAULTS)).current;
  const [filter, setFilter] = useState(initial.filter);
  const [qInput, setQInput] = useState(initial.q);
  const [q, setQ] = useState(initial.q);
  const [bookId, setBookId] = useState<string>(initial.bookId);
  const [tag, setTag] = useState<string>(initial.tag);
  const [sort, setSort] = useState<"newest" | "oldest" | "book">(
    initial.sort as "newest" | "oldest" | "book",
  );

  // Debounce search input.
  useEffect(() => {
    const t = setTimeout(() => setQ(qInput), 220);
    return () => clearTimeout(t);
  }, [qInput]);

  useEffect(() => {
    syncUrl({ q, bookId, tag, filter, sort }, URL_DEFAULTS);
  }, [q, bookId, tag, filter, sort]);

  const bookById = useMemo(() => new Map(allBooks.map((b) => [b.id, b])), [allBooks]);

  const tags = useMemo(() => {
    const set = new Set<string>();
    allNotes.forEach((n) => n.tags?.forEach((t) => t && set.add(t)));
    return Array.from(set).sort();
  }, [allNotes]);

  const filtered = useMemo(() => {
    const qn = normalize(q);
    const out = allNotes.filter((n) => {
      if (filter !== "Wszystkie") {
        if (filter === "Ulubione") {
          if (!n.isFavourite) return false;
        } else if (n.type !== (typeMap as Record<string, string>)[filter]) return false;
      }
      if (bookId && n.bookId !== bookId) return false;
      if (tag && !n.tags?.includes(tag)) return false;
      if (qn) {
        const hay = normalize(
          [
            n.quoteText,
            n.content,
            n.title,
            n.chapterTitle,
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
    out.sort((a, b) => {
      if (sort === "book")
        return (bookById.get(a.bookId)?.title || "").localeCompare(
          bookById.get(b.bookId)?.title || "",
        );
      const cmp = (a.createdAt || "").localeCompare(b.createdAt || "");
      return sort === "newest" ? -cmp : cmp;
    });
    return out;
  }, [allNotes, filter, q, bookId, tag, sort, bookById]);

  const hasAnyFilter = Boolean(bookId || tag || q || filter !== "Wszystkie");

  const clearAll = () => {
    setBookId("");
    setTag("");
    setQInput("");
    setQ("");
    setFilter("Wszystkie");
    setSort("newest");
  };

  return (
    <div className="overflow-x-clip">
      <PageHeader
        title="Notatki"
        subtitle={`${allNotes.length} ${pluralPL(allNotes.length, "notatka", "notatki", "notatek")} w ${allBooks.length} ${pluralPL(allBooks.length, "książce", "książkach", "książkach")}`}
        action={
          <Link
            to="/note/$id"
            params={{ id: "new" }}
            className="hidden sm:flex items-center gap-2 px-4 py-2 rounded-full bg-primary text-primary-foreground text-sm"
          >
            <Plus className="w-4 h-4" aria-hidden="true" />
            Nowa notatka
          </Link>
        }
      />
      <div className="px-5 lg:px-10 mb-3">
        <div className="relative">
          <Search
            className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground"
            aria-hidden="true"
          />
          <input
            value={qInput}
            onChange={(e) => setQInput(e.target.value)}
            placeholder="Szukaj w treści, cytatach, tytułach, tagach…"
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
      <Chips
        items={["Wszystkie", "Cytaty", "Rozdziały", "Zdjęcia stron", "Inne", "Ulubione"]}
        value={filter}
        onChange={setFilter}
      />

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
        <select
          value={sort}
          onChange={(e) => setSort(e.target.value as "newest" | "oldest" | "book")}
          aria-label="Sortowanie"
          className="bg-card border border-border rounded-full px-3 py-1.5"
        >
          <option value="newest">Od najnowszych</option>
          <option value="oldest">Od najstarszych</option>
          <option value="book">Wg książki</option>
        </select>
        {hasAnyFilter && (
          <button onClick={clearAll} className="px-3 py-1.5 rounded-full bg-muted">
            Wyczyść filtry
          </button>
        )}
        <span
          className="ml-auto self-center text-muted-foreground"
          role="status"
          aria-live="polite"
          aria-atomic="true"
        >
          {filtered.length > 0
            ? `${filtered.length} ${pluralPL(filtered.length, "notatka", "notatki", "notatek")}`
            : "Brak wyników"}
        </span>
      </div>

      {/* Quick-pick tag chips */}
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

      <div className="px-5 lg:px-10 mt-4 grid sm:grid-cols-2 lg:grid-cols-3 gap-4 pb-12">
        {filtered.length === 0 && (
          <div className="text-sm text-muted-foreground">Brak notatek pasujących do filtrów.</div>
        )}
        {filtered.map((n) => {
          const book = bookById.get(n.bookId);
          const Icon =
            n.type === "quote"
              ? QuoteIcon
              : n.type === "page-photo"
                ? Camera
                : n.type === "chapter"
                  ? ListTree
                  : FileText;
          return (
            <Link
              key={n.id}
              to="/note/$id"
              params={{ id: n.id }}
              className="bg-card rounded-2xl p-5 shadow-soft hover:shadow-warm transition flex flex-col gap-2"
            >
              <div className="flex items-center justify-between">
                <span className="inline-flex items-center gap-1.5 text-[10px] uppercase tracking-widest text-muted-foreground">
                  <Icon className="w-3 h-3" aria-hidden="true" />
                  {typeLabel[n.type]}
                  {n.pageNumber && ` · s. ${n.pageNumber}`}
                </span>
                {n.isFavourite && (
                  <Star className="w-3.5 h-3.5 fill-rose text-rose" aria-label="Ulubione" />
                )}
              </div>
              {n.type === "page-photo" ? (
                n.photoUrl ? (
                  <img
                    src={n.photoUrl}
                    alt=""
                    className="aspect-[4/3] w-full rounded-xl object-cover"
                    loading="lazy"
                  />
                ) : (
                  <div className="aspect-[4/3] rounded-xl bg-gradient-to-br from-accent to-muted grid place-items-center text-xs text-muted-foreground">
                    📸 Strona {n.pageNumber}
                  </div>
                )
              ) : (
                <p
                  className={`text-sm leading-relaxed ${n.type === "quote" ? "font-serif italic" : ""}`}
                >
                  „{n.quoteText ?? n.title ?? n.content?.slice(0, 140) ?? "…"}"
                </p>
              )}
              <div className="text-xs text-muted-foreground mt-auto pt-2 border-t border-border flex items-center justify-between">
                <span className="truncate">{book?.title ?? "—"}</span>
                <span>{formatDatePL(n.createdAt)}</span>
              </div>
              {n.tags && n.tags.length > 0 && (
                <div className="flex gap-1 flex-wrap">
                  {n.tags.map((t) => (
                    <span key={t} className="text-[10px] px-2 py-0.5 rounded-full bg-muted">
                      #{t}
                    </span>
                  ))}
                </div>
              )}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
