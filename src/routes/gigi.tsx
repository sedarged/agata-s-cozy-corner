import { createFileRoute } from "@tanstack/react-router";
import { Link } from "@tanstack/react-router";
import { useMemo } from "react";
import { Sparkles, Settings as SettingsIcon, AlertCircle } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import ChatPanel from "@/components/ChatPanel";
import {
  useBooksQuery,
  useNotesQuery,
  useSettingQuery,
  useOpenAIKeyStatusQuery,
} from "@/lib/api/client";

export const Route = createFileRoute("/gigi")({
  head: () => ({
    meta: [
      { title: "Gigi — Agata" },
      {
        name: "description",
        content:
          "Twoja prywatna towarzyszka czytania. Rozmawiaj o książkach, notatkach i cytatach.",
      },
    ],
  }),
  component: Gigi,
});

const GIGI_DEFAULT_LEVEL = "Cała biblioteka + rozmowy";

function buildContext(
  privacyLevel: string,
  books: ReadonlyArray<{
    id: string;
    title: string;
    author?: string | null;
    status: string;
    rating?: number | null;
    isFavourite?: boolean;
  }>,
  notes: ReadonlyArray<{
    id: string;
    type: string;
    content?: string | null;
    quoteText?: string | null;
    bookId: string;
  }>,
) {
  const levelMap: Record<string, string> = {
    Wyłączone: "off",
    "Tylko aktualna książka": "current_book",
    "Tylko wybrane notatki": "notes_only",
    "Cała biblioteka": "full",
    "Cała biblioteka + rozmowy": "full_plus_chats",
  };
  const level = levelMap[privacyLevel] ?? "full";
  if (level === "off") return { privacyLevel: "off" };

  const mappedBooks = (b: (typeof books)[number]) => ({
    title: b.title,
    author: b.author ?? undefined,
    status: b.status,
    rating: b.rating ?? undefined,
    isFavourite: b.isFavourite,
  });

  const filteredBooks =
    level === "current_book"
      ? books.filter((b) => b.status === "reading").slice(0, 3)
      : books.filter((b) => ["reading", "queue", "finished"].includes(b.status)).slice(0, 20);

  const bookTitleById = new Map(books.map((b) => [b.id, b.title]));

  const mappedNotes =
    level === "notes_only" || level === "full" || level === "full_plus_chats"
      ? notes.slice(0, 30).map((n) => ({
          type: n.type,
          content: n.content ?? undefined,
          quoteText: n.quoteText ?? undefined,
          bookTitle: bookTitleById.get(n.bookId) ?? undefined,
        }))
      : undefined;

  return {
    privacyLevel: level,
    books: filteredBooks.map(mappedBooks),
    notes: mappedNotes,
  };
}

// Settings icon shown in the page header on every Gigi render — the user
// requirement (2026-06-24) is that Settings stays reachable even when the
// chat UI is gated behind the OAuth-first landing.
function GigiSettingsAction() {
  // `aria-label` is the accessible name; when set, the visible text is
  // announced instead of being part of the name. Adding `title` as well
  // would render a redundant tooltip on hover for sighted users, so we
  // skip it. The icon is `aria-hidden` so the screen reader announces
  // just "Ustawienia".
  return (
    <Link
      to="/settings"
      aria-label="Ustawienia"
      className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-card border border-border text-xs hover:bg-muted transition-colors"
    >
      <SettingsIcon className="w-3.5 h-3.5" aria-hidden />
      Ustawienia
    </Link>
  );
}

function Gigi() {
  const { data: books = [] } = useBooksQuery();
  const { data: notes = [] } = useNotesQuery();
  const { data: privacySetting } = useSettingQuery("agata-gigi-privacy");
  const openaiKeyQuery = useOpenAIKeyStatusQuery();
  const privacyLevel = useMemo(() => {
    const value = privacySetting?.value;
    return typeof value === "string" && value.length > 0 ? value : GIGI_DEFAULT_LEVEL;
  }, [privacySetting]);

  // The OpenAI key is sourced from the env (`OPENAI_API_KEY`) or the
  // encrypted settings store (Settings → Prywatność i dostęp Gigi). When
  // neither is configured, the chat composer would just produce a 503
  // from `/api/chat` — so we render a banner above the chat instead of
  // gating the page. The Settings link in the header stays reachable.
  const showNoKeyBanner = openaiKeyQuery.data?.configured === false;

  return (
    // `flex-1 min-h-0` lets the chat layout fit inside the AppShell <main>
    // (which is a flex item inside `min-h-dvh flex`). Previously we used
    // `h-[100dvh]` here, which made the chat taller than the viewport on
    // mobile so the input bar fell off the bottom with no scroll affordance.
    <div className="flex-1 flex flex-col min-h-0">
      <PageHeader
        title={
          <span className="flex items-center gap-2">
            Gigi <Sparkles className="w-6 h-6 text-rose" aria-hidden />
          </span>
        }
        subtitle="Twoja prywatna towarzyszka czytania."
        action={<GigiSettingsAction />}
      />
      {showNoKeyBanner && <GigiNoKeyBanner />}
      <ChatPanel
        chatId={null}
        privacyLevel={privacyLevel}
        books={books}
        notes={notes}
        context={buildContext(privacyLevel, books, notes)}
      />
    </div>
  );
}

// Inline banner shown above the chat when neither `OPENAI_API_KEY` env
// nor a stored user key is configured. Non-blocking: the chat composer
// still renders (the user can type, the send will produce a 503 with the
// `notConfiguredMessage` hint that points them back to Settings).
function GigiNoKeyBanner() {
  return (
    <div
      data-testid="gigi-no-key-banner"
      className="mx-4 sm:mx-5 lg:mx-10 mt-4 p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-sm flex items-start gap-2"
    >
      <AlertCircle className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" aria-hidden />
      <div>
        Brak klucza OpenAI — Gigi nie odpowie na wiadomości.{" "}
        <Link to="/settings" className="underline underline-offset-2">
          Ustaw go w Ustawieniach
        </Link>
        .
      </div>
    </div>
  );
}

// `GigiChat` was extracted to src/components/ChatPanel.tsx in Task 7 —
// the route now renders <ChatPanel chatId={null} ... /> and passes a
// pre-built `/api/chat` context through so the panel doesn't need to
// know about the privacy-level mapping table. Sidebar wiring (Task 8)
// will replace the hardcoded `null` with an active chat id.
