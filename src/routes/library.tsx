import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { type BookStatus } from "@/lib/mock-data";
import { useAllEffectiveBooks } from "@/lib/effective-books";
import { BookCover } from "@/components/BookCover";
import { PageHeader, Chips } from "@/components/PageHeader";
import { Search, Plus, Heart } from "lucide-react";

export const Route = createFileRoute("/library")({
  head: () => ({
    meta: [
      { title: "Biblioteka — Agata" },
      {
        name: "description",
        content: "Twoja prywatna kolekcja książek — czytane, w kolejce, ukończone, ulubione.",
      },
    ],
  }),
  component: Library,
});

const filters = [
  "Wszystkie",
  "W kolejce",
  "Zaczęte",
  "Wstrzymane",
  "Odrzucone",
  "Przeczytane",
  "Ulubione",
];

const filterToStatus: Record<string, BookStatus | null> = {
  "W kolejce": "queue",
  Zaczęte: "reading",
  Wstrzymane: "paused",
  Odrzucone: "dropped",
  Przeczytane: "finished",
};

function Library() {
  const books = useAllEffectiveBooks();
  const [filter, setFilter] = useState("Wszystkie");
  const [q, setQ] = useState("");

  const filtered = books.filter((b) => {
    const status = filterToStatus[filter];
    const matchesFilter =
      filter === "Wszystkie"
        ? true
        : filter === "Ulubione"
          ? b.isFavourite
          : status
            ? b.status === status
            : true;
    const matchesQ =
      !q ||
      b.title.toLowerCase().includes(q.toLowerCase()) ||
      b.author.toLowerCase().includes(q.toLowerCase());
    return matchesFilter && matchesQ;
  });

  return (
    <div>
      <PageHeader
        title="Biblioteka"
        subtitle={`${books.length} książek · ${books.filter((b) => b.isFavourite).length} ulubionych`}
        action={
          <Link
            to="/add-book"
            className="hidden sm:flex items-center gap-2 px-4 py-2 rounded-full bg-primary text-primary-foreground text-sm"
          >
            <Plus className="w-4 h-4" aria-hidden="true" />
            Dodaj książkę
          </Link>
        }
      />
      <div className="px-5 lg:px-10 mb-4">
        <div className="relative">
          <Search
            className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground"
            aria-hidden="true"
          />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Szukaj w bibliotece"
            aria-label="Szukaj w bibliotece"
            className="w-full bg-card border border-border rounded-full pl-11 pr-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
      </div>
      <Chips items={filters} value={filter} onChange={setFilter} />

      {filtered.length === 0 ? (
        <div className="px-5 lg:px-10 mt-8">
          <div className="glass rounded-2xl p-8 text-center">
            <div className="font-serif text-lg text-warm">Brak książek w bibliotece</div>
            <Link
              to="/add-book"
              className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[var(--accent-gold)] text-[var(--bg)] text-sm"
            >
              <Plus className="w-4 h-4" aria-hidden="true" /> Dodaj pierwszą książkę
            </Link>
          </div>
        </div>
      ) : (
        <div className="px-5 lg:px-10 mt-4 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-5 pb-12">
          {filtered.map((b) => {
            const pct = b.pageCount > 0 ? Math.round((b.currentPage / b.pageCount) * 100) : 0;
            return (
              <Link to="/book/$id" params={{ id: b.id }} key={b.id} className="group">
                <div className="relative">
                  <BookCover book={b} size="lg" className="!w-full !h-auto aspect-[2/3]" />
                  {b.isFavourite && (
                    <Heart
                      className="absolute top-2 right-2 w-4 h-4 fill-rose text-rose"
                      aria-hidden="true"
                    />
                  )}
                  <StatusBadge status={b.status} />
                </div>
                <div className="mt-3 text-sm font-medium line-clamp-1">{b.title}</div>
                <div className="text-xs text-muted-foreground line-clamp-1">{b.author}</div>
                {b.status === "reading" && b.pageCount > 0 && (
                  <div
                    className="mt-2 h-1 bg-muted rounded-full overflow-hidden"
                    role="progressbar"
                    aria-valuenow={pct}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-label={`Postęp: ${pct}%`}
                  >
                    <div className="h-full bg-primary" style={{ width: `${pct}%` }} />
                  </div>
                )}
              </Link>
            );
          })}
          <Link
            to="/add-book"
            className="aspect-[2/3] rounded-sm border-2 border-dashed border-border bg-card/50 grid place-items-center text-muted-foreground hover:border-primary hover:text-primary transition"
          >
            <div className="text-center">
              <Plus className="w-7 h-7 mx-auto" aria-hidden="true" />
              <div className="text-xs mt-2">Dodaj książkę</div>
            </div>
          </Link>
        </div>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: BookStatus }) {
  const map: Record<BookStatus, { label: string; cls: string }> = {
    reading: { label: "Zaczęte", cls: "bg-primary text-primary-foreground" },
    queue: { label: "W kolejce", cls: "bg-accent text-accent-foreground" },
    finished: { label: "Przeczytane", cls: "bg-muted text-muted-foreground" },
    paused: { label: "Wstrzymane", cls: "bg-muted text-muted-foreground" },
    dropped: { label: "Odrzucone", cls: "bg-muted text-muted-foreground" },
  };
  const s = map[status];
  return (
    <span
      className={`absolute bottom-2 left-2 text-[9px] uppercase tracking-widest px-2 py-0.5 rounded-full ${s.cls}`}
    >
      {s.label}
    </span>
  );
}
