import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { books } from "@/lib/mock-data";
import { getAllNotes, useNotesVersion } from "@/lib/notes-store";
import { getAllBooks, useBooksVersion } from "@/lib/books-store";
import { PageHeader, Chips } from "@/components/PageHeader";
import { Search, Star, Camera, Quote as QuoteIcon, FileText, ListTree, Plus } from "lucide-react";

export const Route = createFileRoute("/notes")({
  head: () => ({ meta: [{ title: "Notatki — Agata" }] }),
  component: NotesPage,
});

const typeMap = { "Cytaty": "quote", "Rozdziały": "chapter", "Zdjęcia stron": "page-photo", "Inne": "other" } as const;
const typeLabel: Record<string, string> = { quote: "cytat", note: "notatka", "page-photo": "zdjęcie strony", chapter: "rozdział", other: "inne" };

function normalize(s: string) {
  return (s || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

function NotesPage() {
  useNotesVersion();
  useBooksVersion();
  const [filter, setFilter] = useState("Wszystkie");
  const [q, setQ] = useState("");
  const [bookId, setBookId] = useState<string>("");
  const [tag, setTag] = useState<string>("");
  const [sort, setSort] = useState<"newest" | "oldest" | "book">("newest");

  const allNotes = useMemo(() => getAllNotes(), []);
  const allBooks = useMemo(() => {
    const live = getAllBooks();
    // include mock book fallbacks for any noteId not in live
    const ids = new Set(live.map(b => b.id));
    return [...live, ...books.filter(b => !ids.has(b.id))];
  }, []);
  const bookById = useMemo(() => new Map(allBooks.map(b => [b.id, b])), [allBooks]);

  const tags = useMemo(() => {
    const set = new Set<string>();
    allNotes.forEach(n => n.tags?.forEach(t => t && set.add(t)));
    return Array.from(set).sort();
  }, [allNotes]);

  const filtered = useMemo(() => {
    const qn = normalize(q);
    const out = allNotes.filter(n => {
      if (filter !== "Wszystkie") {
        if (filter === "Ulubione") { if (!n.isFavourite) return false; }
        else if (n.type !== (typeMap as Record<string, string>)[filter]) return false;
      }
      if (bookId && n.bookId !== bookId) return false;
      if (tag && !n.tags?.includes(tag)) return false;
      if (qn) {
        const hay = normalize(
          [n.quoteText, n.content, n.title, n.chapterTitle, ...(n.tags || []), bookById.get(n.bookId)?.title, bookById.get(n.bookId)?.author].filter(Boolean).join(" "),
        );
        if (!hay.includes(qn)) return false;
      }
      return true;
    });
    out.sort((a, b) => {
      if (sort === "book") return (bookById.get(a.bookId)?.title || "").localeCompare(bookById.get(b.bookId)?.title || "");
      const cmp = (a.createdAt || "").localeCompare(b.createdAt || "");
      return sort === "newest" ? -cmp : cmp;
    });
    return out;
  }, [allNotes, filter, q, bookId, tag, sort, bookById]);

  return (
    <div>
      <PageHeader title="Notatki" subtitle={`${allNotes.length} notatek w ${allBooks.length} książkach`} action={
        <Link to="/note/new" className="hidden sm:flex items-center gap-2 px-4 py-2 rounded-full bg-primary text-primary-foreground text-sm"><Plus className="w-4 h-4"/>Nowa notatka</Link>
      }/>
      <div className="px-5 lg:px-10 mb-3">
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground"/>
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="Szukaj w treści, cytatach, tytułach, tagach…" className="w-full bg-card border border-border rounded-full pl-11 pr-4 py-2.5 text-sm"/>
        </div>
      </div>
      <Chips items={["Wszystkie","Cytaty","Rozdziały","Zdjęcia stron","Inne","Ulubione"]} value={filter} onChange={setFilter}/>

      <div className="px-5 lg:px-10 mt-3 flex flex-wrap gap-2 text-xs">
        <select value={bookId} onChange={e => setBookId(e.target.value)} className="bg-card border border-border rounded-full px-3 py-1.5">
          <option value="">Wszystkie książki</option>
          {allBooks.map(b => <option key={b.id} value={b.id}>{b.title}</option>)}
        </select>
        <select value={tag} onChange={e => setTag(e.target.value)} className="bg-card border border-border rounded-full px-3 py-1.5">
          <option value="">Wszystkie tagi</option>
          {tags.map(t => <option key={t} value={t}>#{t}</option>)}
        </select>
        <select value={sort} onChange={e => setSort(e.target.value as "newest" | "oldest" | "book")} className="bg-card border border-border rounded-full px-3 py-1.5">
          <option value="newest">Od najnowszych</option>
          <option value="oldest">Od najstarszych</option>
          <option value="book">Wg książki</option>
        </select>
        {(bookId || tag || q) && (
          <button onClick={() => { setBookId(""); setTag(""); setQ(""); }} className="px-3 py-1.5 rounded-full bg-muted">Wyczyść filtry</button>
        )}
      </div>

      <div className="px-5 lg:px-10 mt-4 grid sm:grid-cols-2 lg:grid-cols-3 gap-4 pb-12">
        {filtered.length === 0 && (
          <div className="text-sm text-muted-foreground">Brak notatek pasujących do filtrów.</div>
        )}
        {filtered.map(n => {
          const book = bookById.get(n.bookId);
          const Icon = n.type === "quote" ? QuoteIcon : n.type === "page-photo" ? Camera : n.type === "chapter" ? ListTree : FileText;
          return (
            <Link key={n.id} to="/note/$id" params={{ id: n.id }} className="bg-card rounded-2xl p-5 shadow-soft hover:shadow-warm transition flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <span className="inline-flex items-center gap-1.5 text-[10px] uppercase tracking-widest text-muted-foreground"><Icon className="w-3 h-3"/>{typeLabel[n.type]}{n.pageNumber && ` · s. ${n.pageNumber}`}</span>
                {n.isFavourite && <Star className="w-3.5 h-3.5 fill-rose text-rose"/>}
              </div>
              {n.type === "page-photo" ? (
                n.photoUrl ? (
                  <img src={n.photoUrl} alt="" className="aspect-[4/3] w-full rounded-xl object-cover" loading="lazy" />
                ) : (
                  <div className="aspect-[4/3] rounded-xl bg-gradient-to-br from-accent to-muted grid place-items-center text-xs text-muted-foreground">📸 Strona {n.pageNumber}</div>
                )
              ) : (
                <p className={`text-sm leading-relaxed ${n.type === "quote" ? "font-serif italic" : ""}`}>„{n.quoteText ?? n.title ?? n.content?.slice(0, 140)}"</p>
              )}
              <div className="text-xs text-muted-foreground mt-auto pt-2 border-t border-border flex items-center justify-between">
                <span className="truncate">{book?.title ?? "—"}</span>
                <span>{n.createdAt}</span>
              </div>
              {n.tags && n.tags.length > 0 && <div className="flex gap-1 flex-wrap">{n.tags.map(t => <span key={t} className="text-[10px] px-2 py-0.5 rounded-full bg-muted">#{t}</span>)}</div>}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
