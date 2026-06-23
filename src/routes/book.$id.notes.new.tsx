import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { NoteEditor } from "@/components/NoteEditor";
import { type SimpleNoteType } from "@/lib/mock-data";
import { useBookQuery } from "@/lib/api/client";

const searchSchema = z.object({
  type: z.enum(["quote", "chapter", "other"]).optional(),
});

export const Route = createFileRoute("/book/$id/notes/new")({
  head: () => ({ meta: [{ title: "Nowa notatka — Agata" }] }),
  validateSearch: searchSchema,
  component: NewNote,
});

function NewNote() {
  const { id } = Route.useParams();
  const { type } = Route.useSearch();
  const { data: book } = useBookQuery(id);
  if (!book) {
    return <div className="px-5 pt-16 text-center text-warm">Nie znaleziono książki</div>;
  }
  return (
    <NoteEditor
      book={book as Parameters<typeof NoteEditor>[0]["book"]}
      title="Nowa notatka"
      initialType={(type as SimpleNoteType) ?? "other"}
    />
  );
}
