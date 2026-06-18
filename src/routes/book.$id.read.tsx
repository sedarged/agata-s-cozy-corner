import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { getBookById } from "@/lib/mock-data";
import { BookCover } from "@/components/BookCover";
import { ArrowLeft, Play, Pause, Square, NotebookPen } from "lucide-react";

export const Route = createFileRoute("/book/$id/read")({
  component: ReadPage,
});

function ReadPage() {
  const { id } = Route.useParams();
  const book = getBookById(id)!;
  const [seconds, setSeconds] = useState(0);
  const [running, setRunning] = useState(false);
  const [finished, setFinished] = useState(false);
  const [startPage, setStartPage] = useState<number | "">(book.currentPage);
  const [endPage, setEndPage] = useState<number | "">("");
  const ref = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (running) ref.current = setInterval(() => setSeconds(s => s + 1), 1000);
    return () => { if (ref.current) clearInterval(ref.current); };
  }, [running]);

  const hh = String(Math.floor(seconds / 3600)).padStart(2, "0");
  const mm = String(Math.floor((seconds % 3600) / 60)).padStart(2, "0");
  const ss = String(seconds % 60).padStart(2, "0");

  const pagesRead =
    typeof startPage === "number" && typeof endPage === "number" && endPage >= startPage
      ? endPage - startPage
      : 0;
  const progress = Math.min(100, Math.round(((Number(endPage) || book.currentPage) / book.pageCount) * 100));

  return (
    <div className="px-4 sm:px-6 lg:px-10 pb-16">
      <div className="flex items-center justify-between pt-2 pb-3">
        <Link to="/book/$id" params={{ id }} className="w-10 h-10 grid place-items-center rounded-full glass text-warm hover:bg-[var(--glass-inner)]">
          <ArrowLeft className="w-4 h-4 gold-text" />
        </Link>
        <h1 className="font-serif text-lg">Czytaj</h1>
        <div className="w-10" />
      </div>

      <div className="glass rounded-[24px] p-4 flex items-center gap-4">
        <BookCover book={book} size="md" />
        <div className="min-w-0">
          <div className="font-serif text-lg leading-tight truncate">{book.title}</div>
          <div className="text-sm text-warm-muted truncate">{book.author}</div>
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-4 mt-4">
        {/* Timer */}
        <section className="glass rounded-[24px] p-6 text-center">
          <div className="text-[10px] uppercase tracking-widest text-warm-muted">Czas sesji</div>
          <div className="font-serif text-6xl tabular-nums mt-3 gold-text">{hh}:{mm}:{ss}</div>
          <div className="flex justify-center gap-2 mt-6">
            <button
              onClick={() => { setRunning(true); setFinished(false); }}
              className="px-5 py-2.5 rounded-full bg-[var(--accent-gold)] text-[var(--bg)] text-sm inline-flex items-center gap-2"
            >
              <Play className="w-4 h-4" /> Start
            </button>
            <button
              onClick={() => setRunning(false)}
              className="px-5 py-2.5 rounded-full bg-[var(--glass-inner)] text-warm text-sm inline-flex items-center gap-2"
            >
              <Pause className="w-4 h-4" /> Pauza
            </button>
            <button
              onClick={() => { setRunning(false); setFinished(true); }}
              className="px-5 py-2.5 rounded-full bg-[var(--glass-inner)] text-warm text-sm inline-flex items-center gap-2"
            >
              <Square className="w-4 h-4" /> Zakończ
            </button>
          </div>
        </section>

        {/* Pages */}
        <section className="glass rounded-[24px] p-6">
          <h2 className="font-serif text-lg mb-4">Strony</h2>
          <div className="grid grid-cols-3 gap-3">
            <PageField label="Strona początkowa" value={startPage} onChange={setStartPage} />
            <PageField label="Strona końcowa" value={endPage} onChange={setEndPage} />
            <div className="p-3 rounded-xl bg-[var(--glass-inner)] text-center">
              <div className="text-[10px] uppercase tracking-widest text-warm-muted">Przeczytane strony</div>
              <div className="font-serif text-2xl mt-1">{pagesRead}</div>
            </div>
          </div>
        </section>

        {/* Notes shortcut */}
        <section className="glass rounded-[24px] p-5 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="font-serif text-lg">Dodaj notatkę podczas czytania</div>
            <div className="text-sm text-warm-muted">Cytaty, rozdziały, własne myśli.</div>
          </div>
          <Link
            to="/book/$id/notes"
            params={{ id }}
            className="shrink-0 inline-flex items-center gap-2 px-4 py-2.5 rounded-full bg-[var(--accent-gold)] text-[var(--bg)] text-sm"
          >
            <NotebookPen className="w-4 h-4" /> Notatki
          </Link>
        </section>

        {/* Summary */}
        <section className="glass rounded-[24px] p-5">
          <h2 className="font-serif text-lg mb-3">Podsumowanie sesji</h2>
          <div className="grid grid-cols-3 gap-2 text-center">
            <Cell n={`${hh}:${mm}:${ss}`} l="Czas czytania" />
            <Cell n={pagesRead} l="Przeczytane strony" />
            <Cell n={`${progress}%`} l="Aktualny postęp" />
          </div>
          <button
            disabled={!finished && !running && seconds === 0}
            className="mt-4 w-full py-3 rounded-full bg-[var(--accent-gold)] text-[var(--bg)] font-medium disabled:opacity-40"
          >
            Zapisz sesję
          </button>
        </section>
      </div>
    </div>
  );
}

function PageField({
  label, value, onChange,
}: { label: string; value: number | ""; onChange: (v: number | "") => void }) {
  return (
    <label className="p-3 rounded-xl bg-[var(--glass-inner)] block text-center">
      <span className="text-[10px] uppercase tracking-widest text-warm-muted block">{label}</span>
      <input
        type="number"
        inputMode="numeric"
        value={value}
        onChange={e => onChange(e.target.value === "" ? "" : Number(e.target.value))}
        className="mt-1 w-full bg-transparent text-center font-serif text-2xl outline-none"
      />
    </label>
  );
}

function Cell({ n, l }: { n: React.ReactNode; l: string }) {
  return (
    <div className="p-3 rounded-xl bg-[var(--glass-inner)]">
      <div className="font-serif text-xl">{n}</div>
      <div className="text-[10px] uppercase tracking-widest text-warm-muted mt-1">{l}</div>
    </div>
  );
}
