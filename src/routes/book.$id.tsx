import { createFileRoute, Outlet, notFound, Link } from "@tanstack/react-router";
import { getBookById } from "@/lib/mock-data";

export const Route = createFileRoute("/book/$id")({
  loader: ({ params }) => {
    const book = getBookById(params.id);
    if (!book) throw notFound();
    return { book };
  },
  head: ({ loaderData }) => ({
    meta: [
      { title: `${loaderData?.book.title ?? "Książka"} — Agata` },
      { name: "description", content: loaderData?.book.description?.slice(0, 160) ?? "" },
    ],
  }),
  notFoundComponent: NotFoundBook,
  errorComponent: ({ error }) => <div className="p-10 text-warm">{error.message}</div>,
  component: () => <Outlet />,
});

function NotFoundBook() {
  return (
    <div className="px-5 lg:px-10 pt-16 pb-20 flex flex-col items-center text-center">
      <div className="glass rounded-[28px] p-10 max-w-md w-full">
        <h1 className="font-serif text-2xl mb-3">Nie znaleziono książki</h1>
        <p className="text-sm text-warm-muted mb-6">
          Ta książka mogła zostać usunięta lub identyfikator jest nieprawidłowy.
        </p>
        <Link
          to="/library"
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-[var(--accent-gold)] text-[var(--bg)] text-sm"
        >
          Wróć do biblioteki
        </Link>
      </div>
    </div>
  );
}
