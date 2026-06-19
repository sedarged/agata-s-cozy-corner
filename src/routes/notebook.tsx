import { createFileRoute, Link } from "@tanstack/react-router";
import { BookOpen, ArrowRight } from "lucide-react";

export const Route = createFileRoute("/notebook")({
  head: () => ({
    meta: [
      { title: "Notes iPad — Agata" },
      {
        name: "description",
        content:
          "Ręczne notatki w Agata tworzysz wewnątrz książki — wybierz tytuł z biblioteki, aby otworzyć płótno.",
      },
    ],
  }),
  component: NotebookEntry,
});

function NotebookEntry() {
  return (
    <div className="px-4 sm:px-6 lg:px-10 py-8 lg:py-12 max-w-3xl mx-auto">
      <div className="glass rounded-3xl p-8 lg:p-12 text-center space-y-6">
        <div className="mx-auto w-16 h-16 rounded-2xl bg-[var(--accent-gold)]/15 grid place-items-center gold-text">
          <BookOpen className="w-8 h-8" strokeWidth={1.5} aria-hidden />
        </div>
        <div className="space-y-2">
          <h1 className="font-serif text-3xl lg:text-4xl gold-text">Notes — ręczne pismo</h1>
          <p className="text-warm-muted leading-relaxed max-w-md mx-auto">
            Każda ręczna notatka żyje przy konkretnej książce. Wybierz tytuł z biblioteki, a
            otworzysz płótno z piórem i podkreślaczem.
          </p>
        </div>
        <div className="flex flex-col sm:flex-row gap-3 justify-center pt-2">
          <Link
            to="/library"
            className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-full bg-[var(--accent-gold)] text-[var(--bg)] text-sm font-medium hover:opacity-90 transition-opacity"
          >
            Otwórz bibliotekę
            <ArrowRight className="w-4 h-4" aria-hidden />
          </Link>
          <Link
            to="/add-book"
            className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-full bg-[var(--glass-inner)] text-warm text-sm hover:bg-[var(--glass-strong)] transition-colors"
          >
            Dodaj nową książkę
          </Link>
        </div>
      </div>
    </div>
  );
}
