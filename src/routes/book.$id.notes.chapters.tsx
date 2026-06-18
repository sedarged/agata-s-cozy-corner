import { createFileRoute } from "@tanstack/react-router";
import { NotesListPage } from "@/components/NotesListPage";

export const Route = createFileRoute("/book/$id/notes/chapters")({
  component: () => {
    const { id } = Route.useParams();
    return (
      <NotesListPage
        bookId={id}
        title="Rozdziały"
        helper="Notatki przypisane do rozdziałów tej książki."
        filter="chapter"
        addLabel="Dodaj notatkę rozdziału"
        newSearch={{ type: "chapter" }}
        emptyTitle="Brak notatek rozdziałowych"
        emptyText="Dodaj pierwszą notatkę do rozdziału."
      />
    );
  },
});
