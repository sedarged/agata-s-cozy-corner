import { createFileRoute, Link } from "@tanstack/react-router";
import { books } from "@/lib/mock-data";
import { BookCover } from "@/components/BookCover";
import { PageHeader } from "@/components/PageHeader";

export const Route = createFileRoute("/recommendations")({
  head: () => ({ meta: [{ title: "Recommendations — Agata" }] }),
  component: Recs,
});

const recs = [
  { bookId: "7", match: 95, reason: "I recommend this because you often save notes about emotions, relationships and difficult choices, and you rated similar books highly." },
  { bookId: "6", match: 88, reason: "Music, love, and complicated women — your favourite cocktail. Taylor Jenkins Reid will hit hard." },
  { bookId: "8", match: 82, reason: "You've been pulled to thrillers lately. The Silent Patient earns the genre." },
];

function Recs() {
  return (
    <div>
      <PageHeader title="Recommended for you" subtitle="Gigi picked these from your private library, notes and conversations."/>
      <div className="px-5 lg:px-10 space-y-5 pb-12 max-w-3xl">
        {recs.map(r => {
          const b = books.find(x => x.id === r.bookId)!;
          return (
            <div key={r.bookId} className="bg-card rounded-3xl p-6 shadow-soft flex gap-5">
              <BookCover book={b} size="lg"/>
              <div className="flex-1 min-w-0">
                <div className="text-[10px] uppercase tracking-widest text-rose">{r.match}% match</div>
                <div className="font-serif text-2xl mt-1">{b.title}</div>
                <div className="text-sm text-muted-foreground">{b.author}</div>
                <p className="text-sm mt-3 leading-relaxed">{r.reason}</p>
                <div className="flex flex-wrap gap-2 mt-4">
                  <button className="px-3 py-1.5 rounded-full bg-primary text-primary-foreground text-xs">Add to queue</button>
                  <button className="px-3 py-1.5 rounded-full bg-card border border-border text-xs">Why?</button>
                  <button className="px-3 py-1.5 rounded-full bg-card border border-border text-xs">Show similar</button>
                  <Link to="/book/$id" params={{ id: b.id }} className="px-3 py-1.5 rounded-full bg-card border border-border text-xs">Details</Link>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
