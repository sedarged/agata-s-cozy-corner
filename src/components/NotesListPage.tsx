import { Link } from "@tanstack/react-router";
import { Plus } from "lucide-react";
import { BookStrip, NotesHeader } from "@/components/NotesShared";
import { NoteCard } from "@/components/NoteCard";
import { getBookById, getNotesByBook, getNotesBySimpleType, type SimpleNoteType } from "@/lib/mock-data";

interface Props {
  bookId: string;
  title: string;
  helper: string;
  filter: SimpleNoteType | "all";
  addLabel: string;
  newSearch?: { type?: SimpleNoteType };
  emptyTitle: string;
  emptyText: string;
}

export function NotesListPage({ bookId, title, helper, filter, addLabel, newSearch, emptyTitle, emptyText }: Props) {
  const book = getBookById(bookId);
  if (!book) {
    return (
      <div className="px-5 pt-16 text-center text-warm">
        <div className="glass rounded-[24px] p-8 max-w-md mx-auto">
          <h1 className="font-serif text-xl mb-2">Nie znaleziono książki</h1>
        </div>
      </div>
    );
  }
  const notes = filter === "all" ? getNotesByBook(bookId) : getNotesBySimpleType(bookId, filter);
  const sorted = [...notes].sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));

  return (
    <div className="px-4 sm:px-6 lg:px-10 pb-16">
      <NotesHeader id={bookId} title={title} />
      <BookStrip book={book} />
      <p className="text-sm text-warm-muted mt-3">{helper}</p>

      <Link
        to="/book/$id/notes/new"
        params={{ id: bookId }}
        search={newSearch ?? {}}
        className="mt-3 inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-[var(--accent-gold)] text-[var(--bg)] text-sm"
      >
        <Plus className="w-4 h-4" /> {addLabel}
      </Link>

      {sorted.length === 0 ? (
        <div className="glass rounded-[24px] p-8 mt-6 text-center">
          <h2 className="font-serif text-lg mb-2">{emptyTitle}</h2>
          <p className="text-sm text-warm-muted mb-4">{emptyText}</p>
          <Link
            to="/book/$id/notes/new"
            params={{ id: bookId }}
            search={newSearch ?? {}}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[var(--accent-gold)] text-[var(--bg)] text-sm"
          >
            <Plus className="w-4 h-4" /> {addLabel}
          </Link>
        </div>
      ) : (
        <div className="grid gap-3 mt-4">
          {sorted.map(n => <NoteCard key={n.id} note={n} bookId={bookId} />)}
        </div>
      )}
    </div>
  );
}
