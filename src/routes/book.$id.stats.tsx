import { createFileRoute, Link } from "@tanstack/react-router";
import { getBookById, calculateBookStats } from "@/lib/mock-data";
import { BookCover } from "@/components/BookCover";
import { ArrowLeft } from "lucide-react";
import { Bar, BarChart, ResponsiveContainer, XAxis, YAxis, Tooltip } from "recharts";

export const Route = createFileRoute("/book/$id/stats")({
  component: StatsPage,
});

function StatsPage() {
  const { id } = Route.useParams();
  const book = getBookById(id)!;
  const stats = calculateBookStats(id);
  const totalH = Math.floor(stats.totalMinutes / 60);
  const totalM = stats.totalMinutes % 60;

  const chartData = stats.sessions.map(s => ({
    date: s.date,
    strony: Math.max(0, s.endPage - s.startPage),
  }));

  const tiles = [
    { l: "Ilość przeczytanych stron", v: stats.currentPage || stats.pagesFromSessions },
    { l: "Czas poświęcony na czytanie", v: totalH > 0 ? `${totalH}g ${totalM}m` : `${totalM}m` },
    { l: "Czas w dniach", v: stats.uniqueDays },
    { l: "Postęp", v: `${stats.progress}%` },
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
            <div className="h-full grid place-items-center text-sm text-warm-muted">Brak danych</div>
          )}
        </div>
      </section>

      <section className="glass rounded-[24px] p-5 mt-4">
        <h2 className="font-serif text-lg mb-3">Sesje czytania</h2>
        {stats.sessions.length === 0 ? (
          <div className="text-sm text-warm-muted">Brak zapisanych sesji czytania.</div>
        ) : (
          <ul className="divide-y divide-[var(--glass-border)]">
            {stats.sessions.map(s => (
              <li key={s.id} className="flex items-center justify-between py-3 text-sm">
                <span className="text-warm">{s.date}</span>
                <span className="text-warm-muted">{s.durationMinutes} min</span>
                <span className="text-warm-muted">{Math.max(0, s.endPage - s.startPage)} s.</span>
                <span className="text-warm-muted">{s.startPage} → {s.endPage}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
