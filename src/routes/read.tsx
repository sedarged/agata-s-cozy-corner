// /read is a legacy alias for the global "start reading" entry.
// The real per-book reading session lives at /book/$id/read.
// We pick the user's currently-reading effective book, otherwise fall
// back to /library. If the user has books in the queue, we surface them
// with a one-click "Zacznij czytać" — the old flow sent them through
// /library, /book/$id/status, and 3 form clicks before the timer was
// reachable, which made it look like the timer was broken.
import { createFileRoute, Navigate, Link, useRouter } from "@tanstack/react-router";
import { useBooksQuery, useUpdateBookMutation } from "@/lib/api/client";
import { BookCover } from "@/components/BookCover";
import { Play } from "lucide-react";

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
  const queue = books.filter((b) => b.status === "queue");
  return (
    <div className="px-5 lg:px-10 pt-16 pb-20 flex flex-col items-center text-center">
      <div className="glass rounded-[28px] p-10 max-w-md w-full">
        <h1 className="font-serif text-2xl mb-3">Brak rozpoczętej książki</h1>
        <p className="text-sm text-warm-muted mb-6">
          {queue.length > 0
            ? "Kliknij „Zacznij czytać” przy książce z kolejki — od razu włączy się stoper."
            : "Wybierz książkę w bibliotece i oznacz ją jako „Zaczęte”, żeby rozpocząć sesję czytania."}
        </p>
        {queue.length > 0 ? (
          <ul className="flex flex-col gap-2 mb-2 text-left">
            {queue.slice(0, 3).map((b) => (
              <li key={b.id}>
                <StartReadingRow id={b.id} title={b.title} author={b.author ?? ""} coverUrl={b.coverUrl ?? null} />
              </li>
            ))}
          </ul>
        ) : (
          <Link
            to="/library"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-[var(--accent-gold)] text-[var(--bg)] text-sm"
          >
            Otwórz bibliotekę
          </Link>
        )}
      </div>
    </div>
  );
}

function StartReadingRow({
  id,
  title,
  author,
  coverUrl,
}: {
  id: string;
  title: string;
  author: string;
  coverUrl: string | null;
}) {
  const router = useRouter();
  const update = useUpdateBookMutation();
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await update.mutateAsync({ id, patch: { status: "reading" } });
        } catch {
          // Surface later via toast; navigation still happens so the user
          // can retry. React Query invalidates `qk.books` automatically.
        }
        router.navigate({ to: "/book/$id/read", params: { id } });
      }}
      className="w-full flex items-center gap-3 p-2 rounded-xl bg-[var(--glass-inner)] hover:bg-[var(--glass-inner)]/80 transition text-left"
    >
      <BookCover
        book={{ id, title, author, coverUrl } as never}
        size="sm"
      />
      <div className="min-w-0 flex-1">
        <div className="font-serif text-sm leading-tight truncate">{title}</div>
        <div className="text-xs text-warm-muted truncate">{author}</div>
      </div>
      <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[var(--accent-gold)] text-[var(--bg)] text-xs font-medium shrink-0">
        <Play className="w-3 h-3" aria-hidden="true" />
        Zacznij czytać
      </span>
    </button>
  );
}
