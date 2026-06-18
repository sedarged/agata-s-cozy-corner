import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useState } from "react";
import { bookStatusOptions, statusToKey, type BookStatusKey } from "@/lib/mock-data";
import { getEffectiveBook, updateBookState, useWorkspaceVersion } from "@/lib/book-workspace-store";
import { BookCover } from "@/components/BookCover";
import { ArrowLeft, Check } from "lucide-react";

const KEY_TO_STATUS: Record<BookStatusKey, "reading" | "queue" | "finished" | "paused" | "dropped"> = {
  queue: "queue",
  started: "reading",
  paused: "paused",
  rejected: "dropped",
  finished: "finished",
};

export const Route = createFileRoute("/book/$id/status")({
  component: StatusPage,
});

function StatusPage() {
  useWorkspaceVersion();
  const { id } = Route.useParams();
  const book = getEffectiveBook(id)!;
  const router = useRouter();
  const [value, setValue] = useState<BookStatusKey>(statusToKey(book.status));

  const onSave = () => {
    updateBookState(id, { status: KEY_TO_STATUS[value] });
    router.navigate({ to: "/book/$id", params: { id } });
  };

  return (
    <div className="px-4 sm:px-6 lg:px-10 pb-16">
      <div className="flex items-center justify-between pt-2 pb-3">
        <Link to="/book/$id" params={{ id }} className="w-10 h-10 grid place-items-center rounded-full glass text-warm hover:bg-[var(--glass-inner)]">
          <ArrowLeft className="w-4 h-4 gold-text" />
        </Link>
        <h1 className="font-serif text-lg">Stan książki</h1>
        <div className="w-10" />
      </div>

      <div className="glass rounded-[24px] p-4 flex items-center gap-4">
        <BookCover book={book} size="md" />
        <div className="min-w-0">
          <div className="font-serif text-lg leading-tight truncate">{book.title}</div>
          <div className="text-sm text-warm-muted truncate">{book.author}</div>
        </div>
      </div>

      <div className="space-y-2.5 mt-4 max-w-2xl">
        {bookStatusOptions.map(o => {
          const active = value === o.value;
          return (
            <button
              key={o.value}
              onClick={() => setValue(o.value)}
              className={`w-full text-left p-4 rounded-2xl glass border transition flex items-start gap-3 ${
                active
                  ? "border-[var(--accent-gold)] shadow-[0_0_0_1px_var(--accent-gold),0_8px_30px_-12px_var(--accent-gold)]"
                  : "border-transparent hover:bg-[var(--glass-inner)]"
              }`}
            >
              <span
                className={`mt-0.5 w-5 h-5 rounded-full grid place-items-center border ${
                  active ? "bg-[var(--accent-gold)] border-[var(--accent-gold)] text-[var(--bg)]" : "border-[var(--glass-border)]"
                }`}
              >
                {active && <Check className="w-3 h-3" />}
              </span>
              <span className="min-w-0">
                <span className="block font-serif text-base">{o.label}</span>
                <span className="block text-xs text-warm-muted mt-0.5">{o.description}</span>
              </span>
            </button>
          );
        })}
      </div>

      <button
        onClick={onSave}
        className="mt-6 w-full sm:w-auto px-8 py-3 rounded-full bg-[var(--accent-gold)] text-[var(--bg)] font-medium"
      >
        Zapisz stan
      </button>
    </div>
  );
}
