import { createFileRoute } from "@tanstack/react-router";
import { NotesListPage } from "@/components/NotesListPage";

function BookNotesAll() {
  const { id } = Route.useParams();
  return (
    <NotesListPage
      bookId={id}
      title="Wszystkie notatki"
      helper="Wszystkie notatki z tej książki w jednym miejscu."
      filter="all"
      addLabel="Dodaj notatkę"
      emptyTitle="Brak notatek"
      emptyText="Dodaj pierwszą notatkę do tej książki."
    />
  );
}

export const Route = createFileRoute("/book/$id/notes/all")({
  head: () => ({ meta: [{ title: "Wszystkie notatki — Agata" }] }),
  component: BookNotesAll,
});
