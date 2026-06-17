import { createFileRoute, Link } from "@tanstack/react-router";
import { books, notes } from "@/lib/mock-data";
import { BookCover } from "@/components/BookCover";
import { PageHeader } from "@/components/PageHeader";
import { Sparkles, BookOpen, Heart, Quote, ArrowRight, Camera } from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({ meta: [{ title: "For You — Agata" }, { name: "description", content: "Your private reading feed: currently reading, Gigi recommendations, notes to revisit." }] }),
  component: ForYou,
});

function ForYou() {
  const currentlyReading = books.filter(b => b.status === "reading");
  const gigiPick = books.find(b => b.id === "7")!;
  const featuredNote = notes.find(n => n.id === "n1")!;
  const featuredBook = books.find(b => b.id === featuredNote.bookId)!;

  return (
    <div>
      <PageHeader title={<>For You <span className="text-rose">✨</span></>} subtitle="Wednesday, soft afternoon — pick up where you left off." />

      <div className="px-5 lg:px-10 space-y-6 pb-12 max-w-6xl">

        {/* Currently reading */}
        <section>
          <h2 className="text-[11px] tracking-widest uppercase text-muted-foreground mb-3">Currently reading</h2>
          <div className="grid sm:grid-cols-2 gap-4">
            {currentlyReading.map(b => {
              const pct = Math.round((b.currentPage / b.pageCount) * 100);
              return (
                <Link to="/book/$id" params={{ id: b.id }} key={b.id} className="bg-card rounded-3xl p-5 flex gap-4 shadow-soft hover:shadow-warm transition group">
                  <BookCover book={b} size="md" />
                  <div className="flex-1 min-w-0 flex flex-col justify-between">
                    <div>
                      <div className="font-serif text-xl leading-tight">{b.title}</div>
                      <div className="text-sm text-muted-foreground mt-0.5">{b.author}</div>
                      <div className="text-xs text-muted-foreground mt-3">Page {b.currentPage} of {b.pageCount}</div>
                      <div className="mt-2 h-1.5 bg-muted rounded-full overflow-hidden">
                        <div className="h-full bg-primary rounded-full" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                    <div className="mt-3 flex items-center gap-1.5 text-sm text-primary font-medium">Continue reading <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition"/></div>
                  </div>
                </Link>
              );
            })}
          </div>
        </section>

        {/* Gigi recommends */}
        <section className="bg-gradient-to-br from-accent/40 to-card rounded-3xl p-6 shadow-soft paper-grain">
          <div className="flex items-center gap-2 text-[11px] tracking-widest uppercase text-muted-foreground mb-3">
            <Sparkles className="w-3.5 h-3.5" /> Gigi recommends
          </div>
          <div className="flex gap-5 items-start">
            <BookCover book={gigiPick} size="lg" />
            <div className="flex-1 min-w-0">
              <div className="font-serif text-2xl leading-tight">{gigiPick.title}</div>
              <div className="text-sm text-muted-foreground">{gigiPick.author}</div>
              <div className="mt-3 inline-block text-xs px-2 py-1 rounded-full bg-primary/10 text-primary font-medium">95% match</div>
              <p className="text-sm mt-3 leading-relaxed">"I think you may like this because you often save notes about emotions, relationships and difficult choices."</p>
              <div className="flex flex-wrap gap-2 mt-4">
                <button className="px-3 py-1.5 rounded-full bg-primary text-primary-foreground text-xs">Add to queue</button>
                <button className="px-3 py-1.5 rounded-full bg-card border border-border text-xs">Why this book?</button>
                <button className="px-3 py-1.5 rounded-full bg-card border border-border text-xs">Not for me</button>
              </div>
            </div>
          </div>
        </section>

        {/* Two-column */}
        <div className="grid lg:grid-cols-2 gap-6">
          <section className="bg-card rounded-3xl p-6 shadow-soft">
            <div className="flex items-center gap-2 text-[11px] tracking-widest uppercase text-muted-foreground mb-3"><Quote className="w-3.5 h-3.5"/> Quote of the day</div>
            <blockquote className="font-serif text-xl italic leading-snug">"You do not rise to the level of your goals. You fall to the level of your systems."</blockquote>
            <div className="text-xs text-muted-foreground mt-3">— James Clear · Atomic Habits</div>
          </section>

          <Link to="/note/$id" params={{ id: featuredNote.id }} className="bg-card rounded-3xl p-6 shadow-soft hover:shadow-warm transition block">
            <div className="flex items-center gap-2 text-[11px] tracking-widest uppercase text-muted-foreground mb-3"><BookOpen className="w-3.5 h-3.5"/> Return to this note</div>
            <div className="text-sm leading-relaxed line-clamp-3">"{featuredNote.quoteText}"</div>
            <div className="text-xs text-muted-foreground mt-3">Page {featuredNote.pageNumber} · {featuredBook.title}</div>
          </Link>
        </div>

        {/* Stats strip */}
        <section className="grid grid-cols-4 gap-3">
          {[
            { label: "Pages this week", value: "315" },
            { label: "Reading time", value: "4h 35m" },
            { label: "Notes", value: notes.length },
            { label: "Avg rating", value: "8.4" },
          ].map(s => (
            <div key={s.label} className="bg-card rounded-2xl p-4 shadow-soft text-center">
              <div className="font-serif text-2xl">{s.value}</div>
              <div className="text-[10px] tracking-widest uppercase text-muted-foreground mt-1">{s.label}</div>
            </div>
          ))}
        </section>

        {/* Queue */}
        <section>
          <div className="flex items-end justify-between mb-3">
            <h2 className="text-[11px] tracking-widest uppercase text-muted-foreground">Books in queue</h2>
            <Link to="/library" className="text-xs text-primary">See all →</Link>
          </div>
          <div className="flex gap-4 overflow-x-auto pb-2 no-scrollbar">
            {books.filter(b => b.status === "queue").map(b => (
              <Link to="/book/$id" params={{ id: b.id }} key={b.id} className="shrink-0 w-28">
                <BookCover book={b} size="md" className="!w-28 !h-40" />
                <div className="mt-2 text-xs font-medium line-clamp-1">{b.title}</div>
                <div className="text-[10px] text-muted-foreground line-clamp-1">{b.author}</div>
              </Link>
            ))}
          </div>
        </section>

        {/* Recent activity */}
        <section className="grid lg:grid-cols-2 gap-6">
          <div className="bg-card rounded-3xl p-6 shadow-soft">
            <div className="flex items-center gap-2 text-[11px] tracking-widest uppercase text-muted-foreground mb-3"><Heart className="w-3.5 h-3.5"/> Similar to your favourites</div>
            <div className="flex gap-3">
              {books.filter(b => b.id === "6" || b.id === "8").map(b => (
                <Link key={b.id} to="/book/$id" params={{ id: b.id }} className="flex-1">
                  <BookCover book={b} size="md" className="!w-full !h-44"/>
                  <div className="text-xs mt-2 font-medium line-clamp-1">{b.title}</div>
                </Link>
              ))}
            </div>
          </div>
          <div className="bg-card rounded-3xl p-6 shadow-soft">
            <div className="flex items-center gap-2 text-[11px] tracking-widest uppercase text-muted-foreground mb-3"><Camera className="w-3.5 h-3.5"/> Page photo to review</div>
            <div className="aspect-[3/4] max-h-56 rounded-xl bg-gradient-to-br from-accent to-muted grid place-items-center text-muted-foreground text-xs">
              📸 Page 213 · Fourth Wing
            </div>
            <p className="text-xs text-muted-foreground mt-3">Captured last Friday — you wanted to remember this scene.</p>
          </div>
        </section>
      </div>
    </div>
  );
}
