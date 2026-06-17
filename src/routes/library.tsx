import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { books, type BookStatus } from "@/lib/mock-data";
import { BookCover } from "@/components/BookCover";
import { PageHeader, Chips } from "@/components/PageHeader";
import { Search, Plus, Heart } from "lucide-react";

export const Route = createFileRoute("/library")({
  head: () => ({ meta: [{ title: "Library — Agata" }, { name: "description", content: "Your private book collection — reading, queue, finished, favourites." }] }),
  component: Library,
});

const filters = ["All", "Reading", "Queue", "Finished", "Favourites", "Recommended"];

function Library() {
  const [filter, setFilter] = useState("All");
  const [q, setQ] = useState("");
  const filtered = books.filter(b => {
    const matchesFilter =
      filter === "All" ? true :
      filter === "Reading" ? b.status === "reading" :
      filter === "Queue" ? b.status === "queue" :
      filter === "Finished" ? b.status === "finished" :
      filter === "Favourites" ? b.isFavourite :
      filter === "Recommended" ? b.tags.includes("recommended") || b.id === "7" : true;
    const matchesQ = !q || b.title.toLowerCase().includes(q.toLowerCase()) || b.author.toLowerCase().includes(q.toLowerCase());
    return matchesFilter && matchesQ;
  });

  return (
    <div>
      <PageHeader title="Library" subtitle={`${books.length} books · ${books.filter(b=>b.isFavourite).length} favourites`} action={
        <Link to="/add-book" className="hidden sm:flex items-center gap-2 px-4 py-2 rounded-full bg-primary text-primary-foreground text-sm"><Plus className="w-4 h-4"/>Add book</Link>
      }/>
      <div className="px-5 lg:px-10 mb-4">
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground"/>
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search your library…" className="w-full bg-card border border-border rounded-full pl-11 pr-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"/>
        </div>
      </div>
      <Chips items={filters} value={filter} onChange={setFilter} />

      <div className="px-5 lg:px-10 mt-4 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-5 pb-12">
        {filtered.map(b => {
          const pct = Math.round((b.currentPage / b.pageCount) * 100);
          return (
            <Link to="/book/$id" params={{ id: b.id }} key={b.id} className="group">
              <div className="relative">
                <BookCover book={b} size="lg" className="!w-full !h-auto aspect-[2/3]"/>
                {b.isFavourite && <Heart className="absolute top-2 right-2 w-4 h-4 fill-rose text-rose"/>}
                <StatusBadge status={b.status}/>
              </div>
              <div className="mt-3 text-sm font-medium line-clamp-1">{b.title}</div>
              <div className="text-xs text-muted-foreground line-clamp-1">{b.author}</div>
              {b.status === "reading" && (
                <div className="mt-2 h-1 bg-muted rounded-full overflow-hidden">
                  <div className="h-full bg-primary" style={{ width: `${pct}%` }}/>
                </div>
              )}
            </Link>
          );
        })}
        <Link to="/add-book" className="aspect-[2/3] rounded-sm border-2 border-dashed border-border bg-card/50 grid place-items-center text-muted-foreground hover:border-primary hover:text-primary transition">
          <div className="text-center"><Plus className="w-7 h-7 mx-auto"/><div className="text-xs mt-2">Add book</div></div>
        </Link>
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: BookStatus }) {
  const map: Record<BookStatus, { label: string; cls: string }> = {
    reading: { label: "Reading", cls: "bg-primary text-primary-foreground" },
    queue: { label: "Queue", cls: "bg-accent text-accent-foreground" },
    finished: { label: "Finished", cls: "bg-muted text-muted-foreground" },
    paused: { label: "Paused", cls: "bg-muted text-muted-foreground" },
    dropped: { label: "Dropped", cls: "bg-muted text-muted-foreground" },
  };
  const s = map[status];
  return <span className={`absolute bottom-2 left-2 text-[9px] uppercase tracking-widest px-2 py-0.5 rounded-full ${s.cls}`}>{s.label}</span>;
}
