import { Link } from "@tanstack/react-router";
import { BookCover } from "@/components/BookCover";
import type { Book } from "@/lib/mock-data";
import { ArrowLeft } from "lucide-react";

export function NotesHeader({ id, title }: { id: string; title: string }) {
  return (
    <div className="flex items-center justify-between pt-2 pb-3">
      <Link
        to="/book/$id/notes"
        params={{ id }}
        className="w-10 h-10 grid place-items-center rounded-full glass text-warm hover:bg-[var(--glass-inner)]"
        aria-label="Wróć do notatek"
      >
        <ArrowLeft className="w-4 h-4 gold-text" />
      </Link>
      <h1 className="font-serif text-lg">{title}</h1>
      <div className="w-10" />
    </div>
  );
}

export function BookStrip({ book }: { book: Book }) {
  return (
    <div className="glass rounded-[24px] p-4 flex items-center gap-4">
      <BookCover book={book} size="sm" />
      <div className="min-w-0">
        <div className="font-serif text-base leading-tight truncate">{book.title}</div>
        <div className="text-xs text-warm-muted truncate">{book.author}</div>
      </div>
    </div>
  );
}
