// /read is a legacy alias for the global "start reading" entry.
// The real per-book reading session lives at /book/$id/read.
// We pick the user's currently-reading effective book, otherwise fall back to /library.
import { createFileRoute, Navigate, Link } from "@tanstack/react-router";
import { useBooksQuery } from "@/lib/api/client";

export const Route = createFileRoute("/read")({
  head: () => ({ meta: [{ title: "Sesja czytania — Agata" }] }),
  component: ReadRedirect,
});

function ReadRedirect() {
  const { data: books = [] } = useBooksQuery();
  const current = books.find((b) => b.status === "reading");
  if (current) {
    return <Navigate to="/book/$id/read" params={{ id: current.id }} replace />;
  }
  return (
    <div className="px-5 lg:px-10 pt-16 pb-20 flex flex-col items-center text-center">
      <div className="glass rounded-[28px] p-10 max-w-md w-full">
        <h1 className="font-serif text-2xl mb-3">Brak rozpoczętej książki</h1>
        <p className="text-sm text-warm-muted mb-6">
          Wybierz książkę w bibliotece i oznacz ją jako „Zaczęte", żeby rozpocząć sesję czytania.
        </p>
        <Link
          to="/library"
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-[var(--accent-gold)] text-[var(--bg)] text-sm"
        >
          Otwórz bibliotekę
        </Link>
      </div>
    </div>
  );
}
