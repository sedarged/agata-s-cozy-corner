import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo } from "react";
import { getAllNotes, useNotesVersion } from "@/lib/notes-store";
import { getAllBooks, useBooksVersion } from "@/lib/books-store";
import { PageHeader } from "@/components/PageHeader";
import { formatDatePL } from "@/lib/utils";
import { ChevronRight, Plus } from "lucide-react";

export const Route = createFileRoute("/other-notes")({
  head: () => ({ meta: [{ title: "Inne notatki — Agata" }] }),
  component: Other,
});

function Other() {
  const notesVersion = useNotesVersion();
  const booksVersion = useBooksVersion();
  const others = useMemo(() => getAllNotes().filter((n) => n.type === "other"), [notesVersion]);
  const bookById = useMemo(() => new Map(getAllBooks().map((b) => [b.id, b])), [booksVersion]);

  return (
    <div>
      <PageHeader
        title="Inne notatki"
        subtitle="Teorie, listy postaci, przypomnienia, luźne myśli."
      />
      <div className="px-5 lg:px-10 space-y-3 pb-12">
        {others.length === 0 && (
          <div className="bg-card rounded-2xl p-8 text-center shadow-soft">
            <p className="text-sm text-muted-foreground mb-3">Brak innych notatek.</p>
            <Link
              to="/note/$id"
              params={{ id: "new" }}
              search={{ type: "other" }}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary text-primary-foreground text-sm"
            >
              <Plus className="w-4 h-4" aria-hidden="true" />
              Dodaj notatkę
            </Link>
          </div>
        )}
        {others.map((n) => {
          const book = bookById.get(n.bookId);
          return (
            <Link
              to="/note/$id"
              params={{ id: n.id }}
              key={n.id}
              className="flex items-center gap-4 p-4 bg-card rounded-2xl shadow-soft hover:shadow-warm transition"
            >
              <div className="flex-1 min-w-0">
                <div className="font-medium">{n.title ?? "Notatka"}</div>
                <div className="text-xs text-muted-foreground line-clamp-1">{n.content}</div>
                <div className="text-[10px] text-muted-foreground mt-1">
                  {book?.title ?? "—"} · Zaktualizowano {formatDatePL(n.updatedAt ?? n.createdAt)}
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-muted-foreground" aria-hidden="true" />
            </Link>
          );
        })}
        <Link
          to="/note/$id"
          params={{ id: "new" }}
          search={{ type: "other" }}
          className="flex items-center justify-center gap-2 p-4 rounded-2xl border-2 border-dashed border-border text-muted-foreground hover:text-primary hover:border-primary"
        >
          <Plus className="w-4 h-4" aria-hidden="true" />
          Nowa notatka
        </Link>
      </div>
    </div>
  );
}
