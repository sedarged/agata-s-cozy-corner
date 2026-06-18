import { Link } from "@tanstack/react-router";
import { downloadBackup } from "@/lib/backup";

interface Props {
  error: Error;
  reset?: () => void;
}

export function ErrorScreen({ error, reset }: Props) {
  return (
    <div className="min-h-screen grid place-items-center p-8 text-center bg-background">
      <div className="max-w-md">
        <h1 className="font-serif text-4xl mb-3">Coś poszło nie tak</h1>
        <p className="text-muted-foreground text-sm mb-6">
          Wystąpił niespodziewany błąd. Twoje dane lokalne są bezpieczne — możesz teraz wykonać
          kopię zapasową na wszelki wypadek.
        </p>
        <details className="text-left text-xs text-muted-foreground bg-muted rounded-xl p-3 mb-6">
          <summary className="cursor-pointer">Szczegóły techniczne</summary>
          <pre className="mt-2 whitespace-pre-wrap break-words">{error.message}</pre>
        </details>
        <div className="flex flex-wrap gap-3 justify-center">
          {reset && (
            <button
              onClick={reset}
              className="px-5 py-2.5 rounded-full bg-primary text-primary-foreground text-sm"
            >
              Spróbuj ponownie
            </button>
          )}
          <button
            onClick={() => downloadBackup()}
            className="px-5 py-2.5 rounded-full border border-border bg-card text-sm"
          >
            Pobierz kopię zapasową
          </button>
          <Link
            to="/"
            className="px-5 py-2.5 rounded-full border border-border bg-card text-sm"
          >
            Wróć do biblioteki
          </Link>
        </div>
      </div>
    </div>
  );
}
