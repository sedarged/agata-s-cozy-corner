import { createFileRoute } from "@tanstack/react-router";
import { NotesListPage } from "@/components/NotesListPage";

function BookNotesQuotes() {
  const { id } = Route.useParams();
  return (
    <NotesListPage
      bookId={id}
      title="Cytaty"
      helper="Cytaty zapisane podczas czytania tej książki."
      filter="quote"
      addLabel="Dodaj cytat"
      newSearch={{ type: "quote" }}
      emptyTitle="Brak cytatów"
      emptyText="Zapisz pierwszy cytat z tej książki."
    />
  );
}

export const Route = createFileRoute("/book/$id/notes/quotes")({
  head: () => ({ meta: [{ title: "Cytaty z książki — Agata" }] }),
  component: BookNotesQuotes,
});
