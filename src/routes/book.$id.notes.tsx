import { createFileRoute, Link } from "@tanstack/react-router";
import { getBookById, getNotesByBook } from "@/lib/mock-data";
import { BookCover } from "@/components/BookCover";
import { ArrowLeft, Quote, ListTree, FileText, Sparkles, ChevronRight } from "lucide-react";

export const Route = createFileRoute("/book/$id/notes")({
  component: NotesHub,
});

function NotesHub() {
  const { id } = Route.useParams();
  const book = getBookById(id)!;
  const notes = getNotesByBook(id);
  const quotes = notes.filter(n => n.type === "quote").length;
  const chapters = notes.filter(n => n.type === "chapter").length;
  const others = notes.filter(n => n.type === "other" || n.type === "note").length;

  const cards = [
    { key: "quotes", label: "Cytaty", icon: Quote, count: quotes, desc: "Zapisane cytaty z tej książki" },
    { key: "chapters", label: "Rozdziały", icon: ListTree, count: chapters, desc: "Notatki przypisane do rozdziałów" },
    { key: "other", label: "Inne", icon: FileText, count: others, desc: "Luźne przemyślenia i obserwacje" },
    { key: "all", label: "Wszystko", icon: Sparkles, count: notes.length, desc: "Wszystkie notatki z tej książki" },
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

      <div className="grid sm:grid-cols-2 gap-3 mt-4">
        {cards.map(c => (
          <button
            key={c.key}
            type="button"
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
          </button>
        ))}
      </div>
    </div>
  );
}
