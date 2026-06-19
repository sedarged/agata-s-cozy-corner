import { createFileRoute, Link, Navigate, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { z } from "zod";
import { getNoteById, useNotesVersion } from "@/lib/notes-store";
import {
  getEffectiveBookByIdSafe,
  useAllEffectiveBooks,
  useEffectiveBooksVersion,
} from "@/lib/effective-books";
import { foldText } from "@/lib/utils";
import { ArrowLeft } from "lucide-react";

const SEARCH_TYPES = ["quote", "note", "page-photo", "chapter", "other"] as const;
type WrapperType = (typeof SEARCH_TYPES)[number];

const searchSchema = z.object({
  type: z.enum(SEARCH_TYPES).optional(),
});

export const Route = createFileRoute("/note/$id")({
  validateSearch: (s) => searchSchema.parse(s),
  head: () => ({ meta: [{ title: "Notatka — Agata" }] }),
  component: NoteIdWrapper,
});

function NoteIdWrapper() {
  useNotesVersion();
  useEffectiveBooksVersion();
  const { id } = Route.useParams();
  const search = Route.useSearch();

  if (id === "new") {
    return <NewNoteBookPicker type={search.type} />;
  }

  const note = getNoteById(id);
  if (!note) {
    return (
      <div className="px-5 lg:px-10 pt-16 pb-20 flex flex-col items-center text-center">
        <div className="glass rounded-[28px] p-10 max-w-md w-full">
          <h1 className="font-serif text-2xl mb-3">Nie znaleziono notatki</h1>
          <p className="text-sm text-warm-muted mb-6">
            Ta notatka mogła zostać usunięta lub identyfikator jest nieprawidłowy.
          </p>
          <Link
            to="/notes"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-[var(--accent-gold)] text-[var(--bg)] text-sm"
          >
            Wróć do notatek
          </Link>
        </div>
      </div>
    );
  }

  if (note.bookId) {
    return (
      <Navigate
        to="/book/$id/notes/$noteId"
        params={{ id: note.bookId, noteId: note.id }}
        replace
      />
    );
  }

  return (
    <div className="px-5 lg:px-10 pt-16 pb-20 flex flex-col items-center text-center">
      <div className="glass rounded-[28px] p-10 max-w-md w-full">
        <h1 className="font-serif text-2xl mb-3">Brak powiązanej książki</h1>
        <p className="text-sm text-warm-muted mb-6">
          Ta notatka nie ma przypisanej książki. Otwórz listę notatek, aby kontynuować.
        </p>
        <Link
          to="/notes"
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-[var(--accent-gold)] text-[var(--bg)] text-sm"
        >
          Wróć do notatek
        </Link>
      </div>
    </div>
  );
}

function NewNoteBookPicker({ type }: { type?: WrapperType }) {
  const navigate = useNavigate();
  const books = useAllEffectiveBooks();
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = foldText(query.trim());
    if (!q) return books;
    return books.filter((b) => foldText(b.title).includes(q) || foldText(b.author).includes(q));
  }, [books, query]);

  function pick(bookId: string) {
    const book = getEffectiveBookByIdSafe(bookId);
    if (!book) return;
    const simple: "quote" | "chapter" | "other" | undefined =
      type === "quote" ? "quote" : type === "chapter" ? "chapter" : type ? "other" : undefined;
    navigate({
      to: "/book/$id/notes/new",
      params: { id: bookId },
      search: simple ? { type: simple } : {},
    });
  }

  return (
    <div className="px-5 lg:px-10 pt-6 pb-20 mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <Link
          to="/notes"
          aria-label="Wróć do notatek"
          className="w-10 h-10 grid place-items-center rounded-full glass text-warm hover:bg-[var(--glass-inner)]"
        >
          <ArrowLeft className="w-4 h-4 gold-text" aria-hidden="true" />
        </Link>
        <h1 className="font-serif text-2xl">Wybierz książkę</h1>
      </div>
      <p className="text-sm text-warm-muted mb-4">
        Notatki w Agacie zawsze należą do konkretnej książki. Wybierz, do której chcesz dodać nową
        {type ? ` notatkę typu „${typeLabel(type)}”.` : " notatkę."}
      </p>

      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Szukaj książki…"
        aria-label="Szukaj książki"
        className="w-full bg-card border border-border rounded-full px-4 py-2.5 text-sm mb-4"
      />

      {books.length === 0 ? (
        <div className="glass rounded-[24px] p-8 text-center">
          <p className="text-sm text-warm-muted mb-4">
            Nie masz jeszcze żadnej książki w bibliotece.
          </p>
          <Link
            to="/add-book"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-[var(--accent-gold)] text-[var(--bg)] text-sm"
          >
            Dodaj pierwszą książkę
          </Link>
        </div>
      ) : (
        <ul className="grid gap-2">
          {filtered.map((b) => (
            <li key={b.id}>
              <button
                onClick={() => pick(b.id)}
                className="w-full text-left px-4 py-3 rounded-2xl bg-card border border-border hover:bg-muted transition flex items-baseline justify-between gap-3"
              >
                <span className="min-w-0">
                  <span className="block font-medium truncate">{b.title}</span>
                  <span className="block text-xs text-muted-foreground truncate">{b.author}</span>
                </span>
                <span className="text-xs text-primary shrink-0">Wybierz</span>
              </button>
            </li>
          ))}
          {filtered.length === 0 && (
            <li className="text-sm text-muted-foreground px-2 py-3">Brak wyników.</li>
          )}
        </ul>
      )}
    </div>
  );
}

function typeLabel(t: WrapperType): string {
  switch (t) {
    case "quote":
      return "cytat";
    case "note":
      return "notatka";
    case "page-photo":
      return "zdjęcie strony";
    case "chapter":
      return "rozdział";
    case "other":
      return "inne";
  }
}
