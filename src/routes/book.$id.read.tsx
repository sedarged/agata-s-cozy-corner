import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { getEffectiveBookById as getBookById } from "@/lib/books-store";
import { BookNotFound } from "./book.$id.index";
import {
  getEffectiveBook,
  createReadingSession,
  updateBookState,
  useWorkspaceVersion,
} from "@/lib/book-workspace-store";
import { useBooksVersion } from "@/lib/books-store";
import { BookCover } from "@/components/BookCover";
import { ArrowLeft, Play, Pause, Square, NotebookPen } from "lucide-react";

export const Route = createFileRoute("/book/$id/read")({
  head: () => ({ meta: [{ title: "Sesja czytania — Agata" }] }),
  component: ReadPage,
});

function ReadPage() {
  useWorkspaceVersion();
  useBooksVersion();
  const { id } = Route.useParams();
  const maybeBook = getEffectiveBook(id) ?? getBookById(id);
  const [seconds, setSeconds] = useState(0);
  const [running, setRunning] = useState(false);
  const [finished, setFinished] = useState(false);
  const [startPage, setStartPage] = useState<number | "">(maybeBook?.currentPage ?? 0);
  const [endPage, setEndPage] = useState<number | "">("");
  const [savedMsg, setSavedMsg] = useState<string | null>(null);
  const [errMsg, setErrMsg] = useState<string | null>(null);
  const intRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (running) intRef.current = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => {
      if (intRef.current) {
        clearInterval(intRef.current);
        intRef.current = null;
      }
    };
  }, [running]);

  if (!maybeBook) return <BookNotFound />;
  const book = maybeBook;

  const hh = String(Math.floor(seconds / 3600)).padStart(2, "0");
  const mm = String(Math.floor((seconds % 3600) / 60)).padStart(2, "0");
  const ss = String(seconds % 60).padStart(2, "0");

  const startNum = typeof startPage === "number" ? startPage : null;
  const endNum = typeof endPage === "number" ? endPage : null;
  const pageOrderInvalid = startNum !== null && endNum !== null && endNum < startNum;
  const pagesRead =
    startNum !== null && endNum !== null && endNum >= startNum ? endNum - startNum : 0;
  const totalPages = book.pageCount ?? 0;
  const refPage = endNum ?? book.currentPage ?? 0;
  const progress =
    totalPages > 0 ? Math.max(0, Math.min(100, Math.round((refPage / totalPages) * 100))) : 0;

  const canSave = (finished || (!running && seconds > 0)) && !pageOrderInvalid;

  const onSave = () => {
    setErrMsg(null);
    setSavedMsg(null);
    if (pageOrderInvalid) {
      setErrMsg("Strona końcowa nie może być mniejsza niż początkowa.");
      return;
    }
    const sp = startNum ?? book.currentPage ?? 0;
    const ep = endNum ?? sp;
    const res = createReadingSession({
      bookId: id,
      minutes: Math.max(1, Math.round(seconds / 60)),
      pagesRead,
      startPage: sp,
      endPage: ep,
    });
    if (!res.ok) {
      setErrMsg(
        res.quota
          ? "Brak miejsca na zapisanie sesji na tym urządzeniu."
          : "Nie udało się zapisać sesji.",
      );
      return;
    }
    // Update book state: currentPage forward, status started if queue
    const patch: Parameters<typeof updateBookState>[1] = {};
    if (endNum !== null && endNum > (book.currentPage ?? 0)) {
      patch.currentPage = endNum;
    }
    if (book.status === "queue") patch.status = "reading";
    if (Object.keys(patch).length) updateBookState(id, patch);

    setSavedMsg("Sesja czytania zapisana");
    setSeconds(0);
    setFinished(false);
    setRunning(false);
    setStartPage(endNum ?? startPage);
    setEndPage("");
  };

  const adjustMinutes = (delta: number) => {
    setSeconds((s) => Math.max(0, s + delta * 60));
  };

  return (
    <div className="px-4 sm:px-6 lg:px-10 pb-16">
      <div className="flex items-center justify-between pt-2 pb-3">
        <Link
          to="/book/$id"
          params={{ id }}
          className="w-10 h-10 grid place-items-center rounded-full glass text-warm hover:bg-[var(--glass-inner)]"
        >
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
        <section className="glass rounded-[24px] p-6 text-center">
          <div className="text-[10px] uppercase tracking-widest text-warm-muted">Czas sesji</div>
          <div className="font-serif text-5xl sm:text-6xl tabular-nums mt-3 gold-text" aria-live="off">
            {hh}:{mm}:{ss}
          </div>
          <div className="flex justify-center gap-2 mt-4 flex-wrap" aria-label="Korekta czasu">
            <button
              type="button"
              onClick={() => adjustMinutes(-1)}
              disabled={seconds < 60}
              className="px-3 py-1.5 rounded-full bg-[var(--glass-inner)] text-warm text-xs disabled:opacity-40"
            >
              −1 min
            </button>
            <button
              type="button"
              onClick={() => adjustMinutes(1)}
              className="px-3 py-1.5 rounded-full bg-[var(--glass-inner)] text-warm text-xs"
            >
              +1 min
            </button>
          </div>
          <div className="flex justify-center gap-2 mt-4 flex-wrap">
            <button
              onClick={() => {
                setRunning(true);
                setFinished(false);
                setSavedMsg(null);
              }}
              className="px-5 py-2.5 rounded-full bg-[var(--accent-gold)] text-[var(--bg)] text-sm inline-flex items-center gap-2"
            >
              <Play className="w-4 h-4" aria-hidden="true" /> Start
            </button>
            <button
              onClick={() => setRunning(false)}
              className="px-5 py-2.5 rounded-full bg-[var(--glass-inner)] text-warm text-sm inline-flex items-center gap-2"
            >
              <Pause className="w-4 h-4" aria-hidden="true" /> Pauza
            </button>
            <button
              onClick={() => {
                setRunning(false);
                setFinished(true);
              }}
              className="px-5 py-2.5 rounded-full bg-[var(--glass-inner)] text-warm text-sm inline-flex items-center gap-2"
            >
              <Square className="w-4 h-4" aria-hidden="true" /> Zakończ
            </button>
          </div>
        </section>

        <section className="glass rounded-[24px] p-6">
          <h2 className="font-serif text-lg mb-4">Strony</h2>
          <div className="grid grid-cols-3 gap-3">
            <PageField label="Strona początkowa" value={startPage} onChange={setStartPage} />
            <PageField label="Strona końcowa" value={endPage} onChange={setEndPage} />
            <div className="p-3 rounded-xl bg-[var(--glass-inner)] text-center">
              <div className="text-[10px] uppercase tracking-widest text-warm-muted">
                Przeczytane strony
              </div>
              <div className="font-serif text-2xl mt-1">{pagesRead}</div>
            </div>
          </div>
          {pageOrderInvalid && (
            <div className="mt-3 text-xs text-destructive" role="alert">
              Strona końcowa nie może być mniejsza niż początkowa.
            </div>
          )}
        </section>

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

        <section className="glass rounded-[24px] p-5">
          <h2 className="font-serif text-lg mb-3">Podsumowanie sesji</h2>
          <div className="grid grid-cols-3 gap-2 text-center">
            <Cell n={`${hh}:${mm}:${ss}`} l="Czas czytania" />
            <Cell n={pagesRead} l="Przeczytane strony" />
            <Cell n={`${progress}%`} l="Aktualny postęp" />
          </div>
          <button
            disabled={!canSave}
            onClick={onSave}
            className="mt-4 w-full py-3 rounded-full bg-[var(--accent-gold)] text-[var(--bg)] font-medium disabled:opacity-40"
          >
            Zapisz sesję
          </button>
          {savedMsg && (
            <div className="mt-3 text-xs gold-text text-center" role="status" aria-live="polite">
              {savedMsg}
            </div>
          )}
          {errMsg && (
            <div className="mt-3 text-xs text-destructive text-center" role="alert">
              {errMsg}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

function PageField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number | "";
  onChange: (v: number | "") => void;
}) {
  return (
    <label className="p-3 rounded-xl bg-[var(--glass-inner)] block text-center">
      <span className="text-[10px] uppercase tracking-widest text-warm-muted block">{label}</span>
      <input
        type="number"
        inputMode="numeric"
        value={value}
        onChange={(e) => onChange(e.target.value === "" ? "" : Math.max(0, Number(e.target.value)))}
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
