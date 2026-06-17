import { createFileRoute, Link } from "@tanstack/react-router";
import { books } from "@/lib/mock-data";
import { BookCover } from "@/components/BookCover";
import { PageHeader } from "@/components/PageHeader";

export const Route = createFileRoute("/recommendations")({
  head: () => ({ meta: [{ title: "Rekomendacje — Agata" }] }),
  component: Recs,
});

const recs = [
  { bookId: "7", match: 95, reason: "Polecam, bo często zapisujesz notatki o emocjach, relacjach i trudnych wyborach, a podobne książki oceniłaś wysoko." },
  { bookId: "6", match: 88, reason: "Muzyka, miłość i skomplikowane kobiety — Twój ulubiony koktajl. Taylor Jenkins Reid trafi w punkt." },
  { bookId: "8", match: 82, reason: "Ostatnio ciągnie Cię do thrillerów. Milcząca pacjentka zasługuje na ten gatunek." },
];

function Recs() {
  return (
    <div>
      <PageHeader title="Polecane dla Ciebie" subtitle="Gigi wybrała je z Twojej prywatnej biblioteki, notatek i rozmów."/>
      <div className="px-5 lg:px-10 space-y-5 pb-12 max-w-3xl">
        {recs.map(r => {
          const b = books.find(x => x.id === r.bookId)!;
          return (
            <div key={r.bookId} className="bg-card rounded-3xl p-6 shadow-soft flex gap-5">
              <BookCover book={b} size="lg"/>
              <div className="flex-1 min-w-0">
                <div className="text-[10px] uppercase tracking-widest text-rose">{r.match}% dopasowania</div>
                <div className="font-serif text-2xl mt-1">{b.title}</div>
                <div className="text-sm text-muted-foreground">{b.author}</div>
                <p className="text-sm mt-3 leading-relaxed">{r.reason}</p>
                <div className="flex flex-wrap gap-2 mt-4">
                  <button className="px-3 py-1.5 rounded-full bg-primary text-primary-foreground text-xs">Dodaj do kolejki</button>
                  <button className="px-3 py-1.5 rounded-full bg-card border border-border text-xs">Dlaczego?</button>
                  <button className="px-3 py-1.5 rounded-full bg-card border border-border text-xs">Pokaż podobne</button>
                  <Link to="/book/$id" params={{ id: b.id }} className="px-3 py-1.5 rounded-full bg-card border border-border text-xs">Szczegóły</Link>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
