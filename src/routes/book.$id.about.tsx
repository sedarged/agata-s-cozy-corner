import { createFileRoute, Link } from "@tanstack/react-router";
import { getEffectiveBookById, useBooksVersion } from "@/lib/books-store";
import { BookCover } from "@/components/BookCover";
import { ArrowLeft } from "lucide-react";

export const Route = createFileRoute("/book/$id/about")({
  head: () => ({ meta: [{ title: "O książce — Agata" }] }),
  component: AboutPage,
});

function AboutPage() {
  useBooksVersion();
  const { id } = Route.useParams();
  const book = getEffectiveBookById(id);
  if (!book) return <BookMissing />;
  const safeBook = book;
  const b = safeBook as typeof safeBook & {
    publisher?: string;
    seriesName?: string;
    seriesPart?: number;
  };

  const fields: Array<{ label: string; value: React.ReactNode }> = [
    { label: "Autor", value: book.author },
    { label: "Opis", value: book.description },
    { label: "Liczba stron", value: book.pageCount },
    {
      label: "Część serii",
      value: b.seriesName
        ? `${b.seriesName}${b.seriesPart ? ` · cz. ${b.seriesPart}` : ""}`
        : undefined,
    },
    { label: "Wydawnictwo", value: b.publisher },
    { label: "Data wydania", value: book.publishedDate },
    { label: "Gatunek", value: book.genre },
  ];

  return (
    <div className="px-4 sm:px-6 lg:px-10 pb-16">
      <Header id={id} title="O książce" />
      <SummaryStrip />
      <div className="grid sm:grid-cols-2 gap-3 mt-4">
        {fields.map((f) => (
          <div key={f.label} className="glass rounded-2xl p-4">
            <div className="text-[10px] uppercase tracking-widest text-warm-muted">{f.label}</div>
            <div className="text-sm text-warm mt-1 whitespace-pre-line">
              {f.value || <span className="text-warm-muted">Brak danych</span>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  function SummaryStrip() {
    return (
      <div className="glass rounded-[24px] p-4 flex items-center gap-4 mt-2">
        <BookCover book={safeBook} size="md" />
        <div className="min-w-0">
          <div className="font-serif text-lg leading-tight truncate">{safeBook.title}</div>
          <div className="text-sm text-warm-muted truncate">{safeBook.author}</div>
        </div>
      </div>
    );
  }
}

function BookMissing() {
  return (
    <div className="px-5 lg:px-10 pt-16 pb-20 flex flex-col items-center text-center">
      <div className="glass rounded-[28px] p-10 max-w-md w-full">
        <h1 className="font-serif text-2xl mb-3">Nie znaleziono książki</h1>
        <p className="text-sm text-warm-muted mb-6">
          Ta książka mogła zostać usunięta lub identyfikator jest nieprawidłowy.
        </p>
        <Link
          to="/library"
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-[var(--accent-gold)] text-[var(--bg)] text-sm"
        >
          Wróć do biblioteki
        </Link>
      </div>
    </div>
  );
}

function Header({ id, title }: { id: string; title: string }) {
  return (
    <div className="flex items-center justify-between pt-2 pb-3">
      <Link
        to="/book/$id"
        params={{ id }}
        className="w-10 h-10 grid place-items-center rounded-full glass text-warm hover:bg-[var(--glass-inner)]"
        aria-label="Wróć"
      >
        <ArrowLeft className="w-4 h-4 gold-text" />
      </Link>
      <h1 className="font-serif text-lg">{title}</h1>
      <div className="w-10" />
    </div>
  );
}
