import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/PageHeader";
import { sessions, books, notes } from "@/lib/mock-data";
import { BookCover } from "@/components/BookCover";

export const Route = createFileRoute("/statistics")({
  head: () => ({ meta: [{ title: "Statistics — Agata" }] }),
  component: Statistics,
});

const maxPages = Math.max(...sessions.map(s => s.endPage - s.startPage));

function Statistics() {
  const stats = [
    { l: "Pages read", v: "1,248" },
    { l: "Reading time", v: "28h 45m" },
    { l: "Reading days", v: 18 },
    { l: "Books finished", v: 3 },
    { l: "Notes", v: notes.length },
    { l: "Quotes", v: notes.filter(n => n.type==="quote").length },
    { l: "Page photos", v: 16 },
    { l: "Avg rating", v: "8.7" },
  ];
  return (
    <div>
      <PageHeader title="Statistics" subtitle="This month at a glance."/>
      <div className="px-5 lg:px-10 pb-12 space-y-6 max-w-6xl">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {stats.map(s => (
            <div key={s.l} className="bg-card rounded-2xl p-5 shadow-soft text-center">
              <div className="font-serif text-3xl">{s.v}</div>
              <div className="text-[10px] uppercase tracking-widest text-muted-foreground mt-1">{s.l}</div>
            </div>
          ))}
        </div>

        <div className="grid lg:grid-cols-2 gap-6">
          <div className="bg-card rounded-3xl p-6 shadow-soft">
            <h3 className="font-serif text-lg mb-4">Pages read this week</h3>
            <div className="flex items-end gap-3 h-48">
              {sessions.map(s => (
                <div key={s.id} className="flex-1 flex flex-col items-center gap-2">
                  <div className="w-full bg-primary/80 rounded-t-md" style={{ height: `${((s.endPage - s.startPage) / maxPages) * 100}%` }}/>
                  <div className="text-[10px] text-muted-foreground">{s.date}</div>
                </div>
              ))}
            </div>
          </div>
          <div className="bg-card rounded-3xl p-6 shadow-soft">
            <h3 className="font-serif text-lg mb-4">Reading time this month</h3>
            <svg viewBox="0 0 200 100" className="w-full h-48">
              <polyline fill="none" stroke="var(--primary)" strokeWidth="2"
                points="0,80 20,70 40,75 60,55 80,60 100,45 120,50 140,30 160,40 180,20 200,15"/>
              <polygon fill="var(--primary)" opacity="0.15"
                points="0,80 20,70 40,75 60,55 80,60 100,45 120,50 140,30 160,40 180,20 200,15 200,100 0,100"/>
            </svg>
          </div>
        </div>

        <div className="grid lg:grid-cols-2 gap-6">
          <div className="bg-card rounded-3xl p-6 shadow-soft">
            <h3 className="font-serif text-lg mb-4">Highest rated</h3>
            <div className="space-y-3">
              {books.filter(b => b.rating).sort((a,b) => (b.rating!-a.rating!)).slice(0,4).map(b => (
                <div key={b.id} className="flex items-center gap-3">
                  <BookCover book={b} size="sm" className="!w-10 !h-14"/>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium line-clamp-1">{b.title}</div>
                    <div className="text-xs text-muted-foreground">{b.author}</div>
                  </div>
                  <div className="font-serif text-lg">{b.rating}/10</div>
                </div>
              ))}
            </div>
          </div>
          <div className="bg-card rounded-3xl p-6 shadow-soft">
            <h3 className="font-serif text-lg mb-4">Most used tags</h3>
            <div className="flex flex-wrap gap-2">
              {["motivation","romance","emotional","theory","important","strength","dragons","choices","growth","beautiful prose"].map((t, i) => (
                <span key={t} className="px-3 py-1.5 rounded-full bg-muted text-sm" style={{ fontSize: `${1 - i*0.04}rem` }}>{t}</span>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
