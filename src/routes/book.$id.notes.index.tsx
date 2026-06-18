import { createFileRoute, Link } from "@tanstack/react-router";
import { simpleType } from "@/lib/mock-data";
import { getEffectiveBookById as getBookById } from "@/lib/books-store";
import { getNotesForBook, useNotesVersion } from "@/lib/notes-store";
import { BookCover } from "@/components/BookCover";
import { ArrowLeft, Quote, ListTree, FileText, Sparkles, ChevronRight, Plus } from "lucide-react";

export const Route = createFileRoute("/book/$id/notes/")({
  component: NotesHub,
});

function NotesHub() {
  useNotesVersion();
  const { id } = Route.useParams();
  const book = getBookById(id)!;
  const notes = getNotesForBook(id);
  const quotes = notes.filter(n => simpleType(n.type) === "quote").length;
  const chapters = notes.filter(n => simpleType(n.type) === "chapter").length;
  const others = notes.filter(n => simpleType(n.type) === "other").length;

  const cards = [
    { key: "quotes", label: "Cytaty", icon: Quote, count: quotes, desc: "Zapisane cytaty z tej książki", to: "/book/$id/notes/quotes" as const },
    { key: "chapters", label: "Rozdziały", icon: ListTree, count: chapters, desc: "Notatki przypisane do rozdziałów", to: "/book/$id/notes/chapters" as const },
    { key: "other", label: "Inne", icon: FileText, count: others, desc: "Luźne przemyślenia i obserwacje", to: "/book/$id/notes/other" as const },
    { key: "all", label: "Wszystko", icon: Sparkles, count: notes.length, desc: "Wszystkie notatki z tej książki", to: "/book/$id/notes/all" as const },
  ];

  return (
    <div className="px-4 sm:px-6 lg:px-10 pb-16">
      <div className="flex items-center justify-between pt-2 pb-3">
        <Link to="/book/$id" params={{ id }} className="w-10 h-10 grid place-items-center rounded-full glass text-warm hover:bg-[var(--glass-inner)]">
          <ArrowLeft className="w-4 h-4 gold-text" />
        </Link>
        <h1 className="font-serif text-lg">Notatki</h1>
        <div className="w-10" />
      </div>

      <div className="glass rounded-[24px] p-4 flex items-center gap-4">
        <BookCover book={book} size="md" />
        <div className="min-w-0">
          <div className="font-serif text-lg leading-tight truncate">{book.title}</div>
          <div className="text-sm text-warm-muted truncate">{book.author}</div>
        </div>
      </div>

      <Link
        to="/book/$id/notes/new"
        params={{ id }}
        className="mt-4 inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-[var(--accent-gold)] text-[var(--bg)] text-sm"
      >
        <Plus className="w-4 h-4" /> Dodaj notatkę
      </Link>

      <div className="grid sm:grid-cols-2 gap-3 mt-4">
        {cards.map(c => (
          <Link
            key={c.key}
            to={c.to}
            params={{ id }}
            className="glass rounded-2xl p-5 text-left flex items-start gap-3 hover:bg-[var(--glass-inner)] transition"
          >
            <span className="w-10 h-10 rounded-full bg-[var(--glass-inner)] grid place-items-center shrink-0">
              <c.icon className="w-4 h-4 gold-text" />
            </span>
            <span className="flex-1 min-w-0">
              <span className="flex items-center justify-between">
                <span className="font-serif text-base">{c.label}</span>
                <span className="text-xs text-warm-muted">{c.count}</span>
              </span>
              <span className="block text-xs text-warm-muted mt-1">{c.desc}</span>
            </span>
            <ChevronRight className="w-4 h-4 gold-text mt-1 opacity-60" />
          </Link>
        ))}
      </div>
    </div>
  );
}
