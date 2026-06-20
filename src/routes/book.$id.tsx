import { createFileRoute, Outlet, Link } from "@tanstack/react-router";
import { ErrorScreen } from "@/components/ErrorScreen";

export const Route = createFileRoute("/book/$id")({
  // No loader — local books live in localStorage (client-only). A server-side
  // loader would always throw notFound for /book/local-… on SSR/prerender.
  // Child routes look up the effective book client-side via getEffectiveBookById
  // + useBooksVersion and render a Polish not-found UI if missing after hydration.
  head: () => ({
    meta: [{ title: "Książka — Agata" }],
  }),
  notFoundComponent: NotFoundBook,
  errorComponent: ({ error, reset }) => <ErrorScreen error={error} reset={reset} />,
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
