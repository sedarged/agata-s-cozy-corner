import { createFileRoute, Link } from "@tanstack/react-router";
import { BookCover } from "@/components/BookCover";
import { ArrowLeft, Pencil, Trash2, Check, X } from "lucide-react";
import { Bar, BarChart, ResponsiveContainer, XAxis, YAxis, Tooltip } from "recharts";
import { useState } from "react";
import {
  getEffectiveBook,
  getCombinedSessionsForBook,
  updateReadingSession,
  deleteReadingSession,
  useWorkspaceVersion,
  type CombinedSession,
} from "@/lib/book-workspace-store";
import { BookNotFound } from "./book.$id.index";

export const Route = createFileRoute("/book/$id/stats")({
  component: StatsPage,
});

function StatsPage() {
  useWorkspaceVersion();
  const { id } = Route.useParams();
  const book = getEffectiveBook(id);
  if (!book) return <BookNotFound />;
  const sessions = getCombinedSessionsForBook(id);
  const totalMinutes = sessions.reduce((a, s) => a + (s.minutes || 0), 0);
  const pagesFromSessions = sessions.reduce((a, s) => a + Math.max(0, s.pagesRead || 0), 0);
  const uniqueDays = new Set(sessions.map(s => s.date)).size;
  const totalPages = book.pageCount ?? 0;
  const currentPage = book.currentPage ?? 0;
  const progress = totalPages > 0
    ? Math.max(0, Math.min(100, Math.round((currentPage / totalPages) * 100)))
    : 0;
  const totalH = Math.floor(totalMinutes / 60);
  const totalM = totalMinutes % 60;

  const chartData = sessions.map(s => ({
    date: s.date,
    strony: Math.max(0, s.pagesRead || 0),
  }));

  const tiles = [
    { l: "Ilość przeczytanych stron", v: currentPage || pagesFromSessions },
    { l: "Czas poświęcony na czytanie", v: totalH > 0 ? `${totalH}g ${totalM}m` : `${totalM}m` },
    { l: "Czas w dniach", v: uniqueDays },
    { l: "Postęp", v: `${progress}%` },
  ];

  return (
    <div className="px-4 sm:px-6 lg:px-10 pb-16">
      <div className="flex items-center justify-between pt-2 pb-3">
        <Link to="/book/$id" params={{ id }} className="w-10 h-10 grid place-items-center rounded-full glass text-warm hover:bg-[var(--glass-inner)]">
          <ArrowLeft className="w-4 h-4 gold-text" />
        </Link>
        <h1 className="font-serif text-lg">Statystyki książki</h1>
        <div className="w-10" />
      </div>

      <div className="glass rounded-[24px] p-4 flex items-center gap-4">
        <BookCover book={book} size="md" />
        <div className="min-w-0">
          <div className="font-serif text-lg leading-tight truncate">{book.title}</div>
          <div className="text-sm text-warm-muted truncate">{book.author}</div>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mt-4">
        {tiles.map(t => (
          <div key={t.l} className="glass rounded-2xl p-4 text-center">
            <div className="font-serif text-2xl">{t.v}</div>
            <div className="text-[10px] uppercase tracking-widest text-warm-muted mt-1">{t.l}</div>
          </div>
        ))}
      </div>

      <section className="glass rounded-[24px] p-5 mt-4">
        <h2 className="font-serif text-lg mb-3">Postęp czytania</h2>
        <div className="h-52">
          {chartData.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <XAxis dataKey="date" stroke="currentColor" fontSize={11} tickLine={false} axisLine={false} />
                <YAxis stroke="currentColor" fontSize={11} tickLine={false} axisLine={false} width={28} />
                <Tooltip cursor={{ fill: "rgba(255,255,255,0.05)" }} contentStyle={{ background: "var(--bg)", border: "1px solid var(--glass-border)", borderRadius: 12, fontSize: 12 }} />
                <Bar dataKey="strony" fill="var(--accent-gold)" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-full grid place-items-center text-sm text-warm-muted">Brak zapisanych sesji czytania.</div>
          )}
        </div>
      </section>

      <section className="glass rounded-[24px] p-5 mt-4">
        <h2 className="font-serif text-lg mb-3">Lista sesji</h2>
        {sessions.length === 0 ? (
          <div className="text-sm text-warm-muted">Brak zapisanych sesji czytania.</div>
        ) : (
          <ul className="divide-y divide-[var(--glass-border)]">
            {sessions.map(s => <SessionRow key={s.id} s={s} />)}
          </ul>
        )}
      </section>
    </div>
  );
}

function SessionRow({ s }: { s: CombinedSession }) {
  const [editing, setEditing] = useState(false);
  const [confirmDel, setConfirmDel] = useState(false);
  const [date, setDate] = useState(s.date);
  const [minutes, setMinutes] = useState(String(s.minutes));
  const [startPage, setStartPage] = useState(String(s.startPage));
  const [endPage, setEndPage] = useState(String(s.endPage));
  const [saveErr, setSaveErr] = useState<string | null>(null);

  if (!editing) {
    const ppm = s.minutes > 0 ? (s.pagesRead / s.minutes).toFixed(1).replace(".", ",") : "—";
    return (
      <li className="flex items-center justify-between py-3 text-sm gap-3">
        <span className="text-warm w-24">{s.date}</span>
        <span className="text-warm-muted flex-1">{s.minutes} min</span>
        <span className="text-warm-muted w-12 text-right">{s.pagesRead} s.</span>
        <span className="text-warm-muted w-20 text-right hidden sm:inline" title="Strony na minutę">
          {ppm} str./min
        </span>
        <span className="text-warm-muted hidden sm:inline">{s.startPage} → {s.endPage}</span>
        {s.isLocal ? (
          confirmDel ? (
            <span className="inline-flex gap-1">
              <button
                onClick={() => { deleteReadingSession(s.id); }}
                className="px-2.5 py-1 rounded-full bg-rose-500/80 text-white text-xs"
              >Usuń</button>
              <button
                onClick={() => setConfirmDel(false)}
                className="px-2.5 py-1 rounded-full bg-[var(--glass-inner)] text-warm text-xs"
              >Anuluj</button>
            </span>
          ) : (
            <span className="inline-flex gap-1">
              <button
                onClick={() => setEditing(true)}
                aria-label="Edytuj sesję"
                className="w-7 h-7 grid place-items-center rounded-full bg-[var(--glass-inner)] text-warm"
              ><Pencil className="w-3.5 h-3.5" aria-hidden="true" /></button>
              <button
                onClick={() => setConfirmDel(true)}
                aria-label="Usuń sesję"
                className="w-7 h-7 grid place-items-center rounded-full bg-[var(--glass-inner)] text-warm"
              ><Trash2 className="w-3.5 h-3.5" aria-hidden="true" /></button>
            </span>
          )
        ) : (
          <span className="text-[10px] text-warm-muted italic">demo</span>
        )}
      </li>
    );
  }

  const save = () => {
    const sp = parseInt(startPage, 10) || 0;
    const ep = parseInt(endPage, 10) || 0;
    if (ep < sp) {
      setSaveErr("Strona końcowa nie może być mniejsza niż początkowa.");
      return;
    }
    updateReadingSession(s.id, {
      date,
      minutes: Math.max(0, parseInt(minutes, 10) || 0),
      startPage: sp,
      endPage: ep,
      pagesRead: Math.max(0, ep - sp),
    });
    setEditing(false);
  };

  return (
    <li className="py-3">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
        <label className="flex flex-col gap-1">
          <span className="text-warm-muted">Data</span>
          <input type="date" value={date} onChange={e => setDate(e.target.value)} className="bg-[var(--glass-inner)] rounded-lg px-2 py-1.5 text-warm" />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-warm-muted">Minuty</span>
          <input inputMode="numeric" value={minutes} onChange={e => setMinutes(e.target.value.replace(/\D/g, ""))} className="bg-[var(--glass-inner)] rounded-lg px-2 py-1.5 text-warm" />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-warm-muted">Od strony</span>
          <input inputMode="numeric" value={startPage} onChange={e => setStartPage(e.target.value.replace(/\D/g, ""))} className="bg-[var(--glass-inner)] rounded-lg px-2 py-1.5 text-warm" />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-warm-muted">Do strony</span>
          <input inputMode="numeric" value={endPage} onChange={e => setEndPage(e.target.value.replace(/\D/g, ""))} className="bg-[var(--glass-inner)] rounded-lg px-2 py-1.5 text-warm" />
        </label>
      </div>
      {saveErr && <div className="mt-2 text-xs text-[var(--accent-gold)]" role="alert">{saveErr}</div>}
      <div className="flex gap-2 mt-2 justify-end">
        <button onClick={save} className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full bg-[var(--accent-gold)] text-[var(--bg)] text-xs"><Check className="w-3 h-3" aria-hidden="true" />Zapisz</button>
        <button onClick={() => { setEditing(false); setSaveErr(null); }} className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full bg-[var(--glass-inner)] text-warm text-xs"><X className="w-3 h-3" aria-hidden="true" />Anuluj</button>
      </div>
    </li>
  );
}
