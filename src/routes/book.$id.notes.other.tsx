import { createFileRoute } from "@tanstack/react-router";
import { NotesListPage } from "@/components/NotesListPage";

function BookNotesOther() {
  const { id } = Route.useParams();
  return (
    <NotesListPage
      bookId={id}
      title="Inne"
      helper="Luźne przemyślenia, obserwacje i własne notatki."
      filter="other"
      addLabel="Dodaj notatkę"
      newSearch={{ type: "other" }}
      emptyTitle="Brak notatek"
      emptyText="Dodaj pierwszą własną notatkę do tej książki."
    />
  );
}

export const Route = createFileRoute("/book/$id/notes/other")({
  component: BookNotesOther,
});
