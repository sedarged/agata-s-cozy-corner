import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { books } from "@/lib/mock-data";
import { getAllNotes, useNotesVersion } from "@/lib/notes-store";
import { getAllBooks, useBooksVersion } from "@/lib/books-store";
import { PageHeader, Chips } from "@/components/PageHeader";
import { Sparkles, Star, Search } from "lucide-react";

export const Route = createFileRoute("/quotes")({
  head: () => ({ meta: [{ title: "Cytaty — Agata" }] }),
  component: Quotes,
});

function normalize(s: string) {
  return (s || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

function Quotes() {
  useNotesVersion();
  useBooksVersion();
  const [tab, setTab] = useState("Wszystkie");
  const [q, setQ] = useState("");
  const [bookId, setBookId] = useState("");
  const [tag, setTag] = useState("");

  const allBooks = useMemo(() => {
    const live = getAllBooks();
    const ids = new Set(live.map(b => b.id));
    return [...live, ...books.filter(b => !ids.has(b.id))];
  }, []);
  const bookById = useMemo(() => new Map(allBooks.map(b => [b.id, b])), [allBooks]);

  const allQuotes = useMemo(() => getAllNotes().filter(n => n.type === "quote"), []);
  const tags = useMemo(() => {
    const set = new Set<string>();
    allQuotes.forEach(n => n.tags?.forEach(t => t && set.add(t)));
    return Array.from(set).sort();
  }, [allQuotes]);

  const quotes = useMemo(() => {
    const qn = normalize(q);
    return allQuotes.filter(n => {
      if (tab === "Ulubione" && !n.isFavourite) return false;
      if (bookId && n.bookId !== bookId) return false;
      if (tag && !n.tags?.includes(tag)) return false;
      if (qn) {
        const hay = normalize([n.quoteText, n.content, n.title, ...(n.tags || []), bookById.get(n.bookId)?.title, bookById.get(n.bookId)?.author].filter(Boolean).join(" "));
        if (!hay.includes(qn)) return false;
      }
      return true;
    });
  }, [allQuotes, tab, q, bookId, tag, bookById]);

  return (
    <div>
      <PageHeader title="Cytaty" subtitle="Zdania warte zapamiętania."/>
      <div className="px-5 lg:px-10 mb-3">
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground"/>
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="Szukaj cytatów, autorów, tagów…" className="w-full bg-card border border-border rounded-full pl-11 pr-4 py-2.5 text-sm"/>
        </div>
      </div>
      <Chips items={["Wszystkie","Ulubione"]} value={tab} onChange={setTab}/>

      <div className="px-5 lg:px-10 mt-3 flex flex-wrap gap-2 text-xs">
        <select value={bookId} onChange={e => setBookId(e.target.value)} className="bg-card border border-border rounded-full px-3 py-1.5">
          <option value="">Wszystkie książki</option>
          {allBooks.map(b => <option key={b.id} value={b.id}>{b.title}</option>)}
        </select>
        <select value={tag} onChange={e => setTag(e.target.value)} className="bg-card border border-border rounded-full px-3 py-1.5">
          <option value="">Wszystkie tagi</option>
          {tags.map(t => <option key={t} value={t}>#{t}</option>)}
        </select>
        {(bookId || tag || q) && (
          <button onClick={() => { setBookId(""); setTag(""); setQ(""); }} className="px-3 py-1.5 rounded-full bg-muted">Wyczyść filtry</button>
        )}
      </div>

      <div className="px-5 lg:px-10 mt-4 grid sm:grid-cols-2 gap-4 pb-12 max-w-4xl">
        {quotes.length === 0 && (
          <div className="text-sm text-muted-foreground">Brak cytatów pasujących do filtrów.</div>
        )}
        {quotes.map(n => {
          const book = bookById.get(n.bookId);
          return (
            <div key={n.id} className="bg-card rounded-3xl p-6 shadow-soft">
              <blockquote className="font-serif italic text-lg leading-snug">„{n.quoteText}"</blockquote>
              <div className="mt-3 text-xs text-muted-foreground flex items-center justify-between">
                <span>{book?.title ?? "—"}{n.pageNumber ? ` · s. ${n.pageNumber}` : ""}</span>
                {n.isFavourite && <Star className="w-3.5 h-3.5 fill-rose text-rose"/>}
              </div>
              {n.tags && n.tags.length > 0 && <div className="flex flex-wrap gap-1 mt-3">{n.tags.map(t => <span key={t} className="text-[10px] px-2 py-0.5 rounded-full bg-muted">#{t}</span>)}</div>}
              <Link to="/gigi" className="mt-4 inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full bg-primary/10 text-primary"><Sparkles className="w-3 h-3"/>Omów z Gigi</Link>
            </div>
          );
        })}
      </div>
    </div>
  );
}
