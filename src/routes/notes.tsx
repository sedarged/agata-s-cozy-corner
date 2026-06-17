import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { notes, books } from "@/lib/mock-data";
import { PageHeader, Chips } from "@/components/PageHeader";
import { Search, Star, Camera, Quote as QuoteIcon, FileText, ListTree, Plus } from "lucide-react";

export const Route = createFileRoute("/notes")({
  head: () => ({ meta: [{ title: "Notes — Agata" }] }),
  component: NotesPage,
});

const typeMap = { "Quotes": "quote", "Chapters": "chapter", "Page Photos": "page-photo", "Other": "other" } as const;

function NotesPage() {
  const [filter, setFilter] = useState("All");
  const [q, setQ] = useState("");
  const filtered = notes.filter(n => {
    const matchFilter =
      filter === "All" ? true :
      filter === "Favourites" ? n.isFavourite :
      n.type === (typeMap as any)[filter];
    const matchQ = !q || (n.quoteText ?? n.content ?? n.title ?? "").toLowerCase().includes(q.toLowerCase());
    return matchFilter && matchQ;
  });

  return (
    <div>
      <PageHeader title="Notes" subtitle={`${notes.length} notes across ${books.length} books`} action={
        <Link to="/note/new" className="hidden sm:flex items-center gap-2 px-4 py-2 rounded-full bg-primary text-primary-foreground text-sm"><Plus className="w-4 h-4"/>New note</Link>
      }/>
      <div className="px-5 lg:px-10 mb-3">
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground"/>
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search notes…" className="w-full bg-card border border-border rounded-full pl-11 pr-4 py-2.5 text-sm"/>
        </div>
      </div>
      <Chips items={["All","Quotes","Chapters","Page Photos","Other","Favourites"]} value={filter} onChange={setFilter}/>

      <div className="px-5 lg:px-10 mt-4 grid sm:grid-cols-2 lg:grid-cols-3 gap-4 pb-12">
        {filtered.map(n => {
          const book = books.find(b => b.id === n.bookId)!;
          const Icon = n.type === "quote" ? QuoteIcon : n.type === "page-photo" ? Camera : n.type === "chapter" ? ListTree : FileText;
          return (
            <Link key={n.id} to="/note/$id" params={{ id: n.id }} className="bg-card rounded-2xl p-5 shadow-soft hover:shadow-warm transition flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <span className="inline-flex items-center gap-1.5 text-[10px] uppercase tracking-widest text-muted-foreground"><Icon className="w-3 h-3"/>{n.type === "page-photo" ? "Page photo" : n.type}{n.pageNumber && ` · p. ${n.pageNumber}`}</span>
                {n.isFavourite && <Star className="w-3.5 h-3.5 fill-rose text-rose"/>}
              </div>
              {n.type === "page-photo" ? (
                <div className="aspect-[4/3] rounded-xl bg-gradient-to-br from-accent to-muted grid place-items-center text-xs text-muted-foreground">📸 Page {n.pageNumber}</div>
              ) : (
                <p className={`text-sm leading-relaxed ${n.type === "quote" ? "font-serif italic" : ""}`}>"{n.quoteText ?? n.title ?? n.content?.slice(0, 140)}"</p>
              )}
              <div className="text-xs text-muted-foreground mt-auto pt-2 border-t border-border flex items-center justify-between">
                <span className="truncate">{book.title}</span>
                <span>{n.createdAt}</span>
              </div>
              {n.tags.length > 0 && <div className="flex gap-1 flex-wrap">{n.tags.map(t => <span key={t} className="text-[10px] px-2 py-0.5 rounded-full bg-muted">{t}</span>)}</div>}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
