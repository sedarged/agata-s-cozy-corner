import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { notes, books } from "@/lib/mock-data";
import { PageHeader, Chips } from "@/components/PageHeader";
import { Sparkles, Star, Search } from "lucide-react";

export const Route = createFileRoute("/quotes")({
  head: () => ({ meta: [{ title: "Cytaty — Agata" }] }),
  component: Quotes,
});

function Quotes() {
  const [tab, setTab] = useState("Wszystkie");
  const [q, setQ] = useState("");
  const quotes = notes.filter(n => n.type === "quote" && (tab === "Ulubione" ? n.isFavourite : true) && (!q || n.quoteText?.toLowerCase().includes(q.toLowerCase())));
  return (
    <div>
      <PageHeader title="Cytaty" subtitle="Zdania warte zapamiętania."/>
      <div className="px-5 lg:px-10 mb-3">
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground"/>
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="Szukaj cytatów…" className="w-full bg-card border border-border rounded-full pl-11 pr-4 py-2.5 text-sm"/>
        </div>
      </div>
      <Chips items={["Wszystkie","Wg książki","Wg tagu","Ulubione"]} value={tab} onChange={setTab}/>
      <div className="px-5 lg:px-10 mt-4 grid sm:grid-cols-2 gap-4 pb-12 max-w-4xl">
        {quotes.map(n => {
          const book = books.find(b => b.id === n.bookId)!;
          return (
            <div key={n.id} className="bg-card rounded-3xl p-6 shadow-soft">
              <blockquote className="font-serif italic text-lg leading-snug">„{n.quoteText}"</blockquote>
              <div className="mt-3 text-xs text-muted-foreground flex items-center justify-between">
                <span>{book.title} · s. {n.pageNumber}</span>
                {n.isFavourite && <Star className="w-3.5 h-3.5 fill-rose text-rose"/>}
              </div>
              <div className="flex flex-wrap gap-1 mt-3">{n.tags.map(t => <span key={t} className="text-[10px] px-2 py-0.5 rounded-full bg-muted">{t}</span>)}</div>
              <Link to="/gigi" className="mt-4 inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full bg-primary/10 text-primary"><Sparkles className="w-3 h-3"/>Omów z Gigi</Link>
            </div>
          );
        })}
      </div>
    </div>
  );
}
