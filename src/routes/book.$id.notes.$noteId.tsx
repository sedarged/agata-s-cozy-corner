import { createFileRoute, Link } from "@tanstack/react-router";
import { NoteEditor } from "@/components/NoteEditor";
import { getBookById } from "@/lib/mock-data";
import { getNoteById, useNotesVersion } from "@/lib/notes-store";

export const Route = createFileRoute("/book/$id/notes/$noteId")({
  component: NoteEdit,
});

function NoteEdit() {
  useNotesVersion();
  const { id, noteId } = Route.useParams();
  const book = getBookById(id);
  const note = getNoteById(noteId);

  if (!book || !note || note.bookId !== id) {
    return (
      <div className="px-5 lg:px-10 pt-16 pb-20 flex flex-col items-center text-center">
        <div className="glass rounded-[28px] p-10 max-w-md w-full">
          <h1 className="font-serif text-2xl mb-3">Nie znaleziono notatki</h1>
          <p className="text-sm text-warm-muted mb-6">
            Ta notatka mogła zostać usunięta lub identyfikator jest nieprawidłowy.
          </p>
          <Link
            to="/book/$id/notes"
            params={{ id }}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-[var(--accent-gold)] text-[var(--bg)] text-sm"
          >
            Wróć do notatek
          </Link>
        </div>
      </div>
    );
  }

  return <NoteEditor book={book} title="Edytuj notatkę" initial={note} existingNoteId={note.id} />;
}
