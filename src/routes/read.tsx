import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { books } from "@/lib/mock-data";
import { BookCover } from "@/components/BookCover";
import { PageHeader } from "@/components/PageHeader";
import { Play, Pause, Square, Quote, FileText, Camera } from "lucide-react";

export const Route = createFileRoute("/read")({
  head: () => ({ meta: [{ title: "Reading session — Agata" }] }),
  component: ReadingSession,
});

function ReadingSession() {
  const book = books[0];
  const [running, setRunning] = useState(true);
  const [seconds, setSeconds] = useState(5077);
  const [startPage] = useState(186);
  const [currentPage, setCurrentPage] = useState(213);
  const ref = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (running) {
      ref.current = setInterval(() => setSeconds(s => s + 1), 1000);
    }
    return () => { if (ref.current) clearInterval(ref.current); };
  }, [running]);

  const hh = String(Math.floor(seconds / 3600)).padStart(2, "0");
  const mm = String(Math.floor((seconds % 3600) / 60)).padStart(2, "0");
  const ss = String(seconds % 60).padStart(2, "0");
  const pagesRead = currentPage - startPage;

  return (
    <div className="lg:bg-[var(--primary)] lg:text-[var(--primary-foreground)] min-h-screen lg:min-h-0">
      <PageHeader title="Reading session" subtitle="Focused mode — take your time."/>
      <div className="grid lg:grid-cols-[1fr_320px] gap-6 px-5 lg:px-10 pb-12">
        <div className="bg-primary text-primary-foreground rounded-3xl p-8 shadow-warm">
          <div className="flex items-center gap-4">
            <BookCover book={book} size="md"/>
            <div>
              <div className="font-serif text-2xl">{book.title}</div>
              <div className="text-sm opacity-80">{book.author}</div>
            </div>
          </div>

          <div className="text-center mt-10">
            <div className="text-[11px] uppercase tracking-widest opacity-70">Session time</div>
            <div className="font-serif text-6xl lg:text-7xl tabular-nums mt-3">{hh}:{mm}:{ss}</div>
          </div>

          <div className="grid grid-cols-3 gap-3 mt-10">
            {[
              { l: "Start page", v: startPage },
              { l: "Current page", v: currentPage },
              { l: "Pages read", v: pagesRead },
            ].map(s => (
              <div key={s.l} className="bg-primary-foreground/10 rounded-2xl p-4 text-center">
                <div className="font-serif text-3xl">{s.v}</div>
                <div className="text-[10px] uppercase tracking-widest opacity-70 mt-1">{s.l}</div>
              </div>
            ))}
          </div>

          <div className="mt-6">
            <div className="text-[11px] uppercase tracking-widest opacity-70">Session goal · 30 pages</div>
            <div className="mt-2 h-1.5 bg-primary-foreground/15 rounded-full overflow-hidden">
              <div className="h-full bg-primary-foreground/70" style={{ width: `${Math.min(100, (pagesRead/30)*100)}%` }}/>
            </div>
          </div>

          <div className="flex justify-center gap-3 mt-8">
            <button onClick={() => setRunning(r => !r)} className="w-14 h-14 rounded-full bg-primary-foreground text-primary grid place-items-center">
              {running ? <Pause className="w-5 h-5"/> : <Play className="w-5 h-5"/>}
            </button>
            <button onClick={() => setCurrentPage(p => p + 1)} className="px-5 rounded-full bg-primary-foreground/15 text-primary-foreground text-sm">+1 page</button>
            <button className="w-14 h-14 rounded-full bg-primary-foreground/15 text-primary-foreground grid place-items-center"><Square className="w-5 h-5"/></button>
          </div>

          <div className="grid grid-cols-3 gap-3 mt-6">
            {[{ i: Quote, l: "Add quote" }, { i: FileText, l: "Add note" }, { i: Camera, l: "Page photo" }].map(a => (
              <Link key={a.l} to="/note/new" className="flex items-center justify-center gap-2 py-3 rounded-xl bg-primary-foreground/15 text-sm"><a.i className="w-4 h-4"/>{a.l}</Link>
            ))}
          </div>

          <button className="w-full mt-4 py-3 rounded-full bg-primary-foreground text-primary font-medium">End session</button>
        </div>

        <aside className="hidden lg:flex flex-col gap-4">
          <div className="bg-card text-foreground rounded-3xl p-5 shadow-soft">
            <h3 className="font-serif text-lg mb-3">Session notes</h3>
            <textarea placeholder="Capture a thought…" className="w-full min-h-32 bg-muted rounded-xl p-3 text-sm"/>
          </div>
          <div className="bg-card text-foreground rounded-3xl p-5 shadow-soft">
            <h3 className="font-serif text-lg mb-2">Recent sessions</h3>
            <ul className="space-y-2 text-sm">
              <li className="flex justify-between"><span>Mon</span><span className="text-muted-foreground">45m · 25 p.</span></li>
              <li className="flex justify-between"><span>Tue</span><span className="text-muted-foreground">30m · 15 p.</span></li>
              <li className="flex justify-between"><span>Wed</span><span className="text-muted-foreground">65m · 30 p.</span></li>
            </ul>
          </div>
        </aside>
      </div>
    </div>
  );
}
