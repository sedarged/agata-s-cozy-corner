import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { books } from "@/lib/mock-data";
import { BookCover } from "@/components/BookCover";
import { PageHeader, Chips } from "@/components/PageHeader";
import { Search, ArrowLeft } from "lucide-react";

export const Route = createFileRoute("/search")({
  head: () => ({ meta: [{ title: "Search — Agata" }] }),
  component: SearchPage,
});

function SearchPage() {
  const [q, setQ] = useState("fourth wing");
  const [tab, setTab] = useState("All");
  const results = books.filter(b => !q || b.title.toLowerCase().includes(q.toLowerCase()) || b.author.toLowerCase().includes(q.toLowerCase()));

  return (
    <div>
      <div className="px-5 lg:px-10 pt-8 flex items-center gap-3">
        <Link to="/add-book" className="p-2 -ml-2 rounded-full hover:bg-muted"><ArrowLeft className="w-5 h-5"/></Link>
        <div className="relative flex-1">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground"/>
          <input value={q} onChange={e => setQ(e.target.value)} className="w-full bg-card border border-border rounded-full pl-11 pr-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring" placeholder="Search by title, author or ISBN"/>
        </div>
      </div>
      <PageHeader title={<span className="text-xl lg:text-2xl">Search results for "{q}"</span>} />
      <Chips items={["All","Titles","Authors","ISBN"]} value={tab} onChange={setTab}/>
      <div className="px-5 lg:px-10 mt-2 space-y-3 max-w-3xl pb-12">
        {results.map(b => (
          <div key={b.id} className="flex gap-4 p-4 rounded-2xl bg-card shadow-soft">
            <BookCover book={b} size="sm" className="!w-20 !h-28"/>
            <div className="flex-1 min-w-0">
              <div className="font-serif text-lg leading-tight">{b.title}</div>
              <div className="text-sm text-muted-foreground">{b.author}</div>
              <div className="text-xs text-muted-foreground mt-1">{b.publishedDate} · {b.genre} · {b.pageCount} pages</div>
              <div className="flex gap-2 mt-3">
                <button className="px-3 py-1.5 rounded-full bg-primary text-primary-foreground text-xs">Add</button>
                <Link to="/book/$id" params={{ id: b.id }} className="px-3 py-1.5 rounded-full bg-card border border-border text-xs">Details</Link>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
