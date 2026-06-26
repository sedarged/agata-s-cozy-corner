import { createFileRoute } from "@tanstack/react-router";
import { Link } from "@tanstack/react-router";
import { useNavigate, useSearch } from "@tanstack/react-router";
import { useMemo } from "react";
import { z } from "zod";
import { Sparkles, Settings as SettingsIcon, AlertCircle } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import ChatPanel from "@/components/ChatPanel";
import { ChatSidebar } from "@/components/ChatSidebar";
import {
  useBooksQuery,
  useNotesQuery,
  useSettingQuery,
  useOpenAIKeyStatusQuery,
  useCreateChatMutation,
} from "@/lib/api/client";

// Task 9: register the active-chat query param so TanStack Router treats
// `?c=<id>` as a typed part of the route's URL state. `c` is optional —
// /gigi is valid without an active chat (the WELCOME bubble renders, and
// the sidebar shows the conversation list). We coerce anything non-string
// to `undefined` so `useSearch().c` is always `string | undefined`, even
// when the URL has `?c[]=…` or `?c=1&c=2`. The Zod object is inferred as
// `{ c?: string }`, which keeps every existing `<Link to="/gigi">` valid
// without forcing callers to pass `search={{ c: undefined }}`.
const gigiSearchSchema = z.object({
  c: z.preprocess((v) => (typeof v === "string" ? v : undefined), z.string().optional()),
});

export const Route = createFileRoute("/gigi")({
  validateSearch: gigiSearchSchema,
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

  // Task 9: deep-link wiring. The active chat id lives in the URL as
  // `?c=<id>`. We pull it out via TanStack Router's typed `useSearch`
  // (which honours the `validateSearch` shape above) and feed it into
  // both the sidebar (highlight) and the panel (which conversation to
  // load). `useNavigate` lets the sidebar push a new `?c=` on selection
  // or on a successful "Nowa rozmowa" mutation.
  const navigate = useNavigate();
  const search = useSearch({ from: "/gigi" });
  const activeChatId = typeof search.c === "string" && search.c.length > 0 ? search.c : null;

  // The sidebar owns the actual "Nowa rozmowa" click (it mints the client
  // id, fires the mutation, and bubbles the persisted id back via
  // `onNewChat`). The route still subscribes to the mutation hook so the
  // page-level React Query observer picks up `qk.chats` invalidations —
  // that keeps any future page-level pending/error UI (or telemetry) wired
  // to the same surface without duplicating the create call.
  void useCreateChatMutation();

  const handleSelect = (id: string) => {
    navigate({ to: "/gigi", search: { c: id } });
  };

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
    //
    // Task 9 layout: PageHeader + (optional) banner stay full-width on
    // top. Below them, a horizontal row pairs <ChatSidebar /> with
    // <ChatPanel />. `flex-1 min-h-0` on the row lets the panel claim the
    // remaining height and scroll its message list independently of the
    // sidebar's list.
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
      <div className="flex flex-col sm:flex-row flex-1 min-h-0">
        <ChatSidebar activeChatId={activeChatId} onSelect={handleSelect} onNewChat={handleSelect} />
        <ChatPanel
          chatId={activeChatId}
          privacyLevel={privacyLevel}
          books={books}
          notes={notes}
          context={buildContext(privacyLevel, books, notes)}
        />
      </div>
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

// `GigiChat` was extracted to src/components/ChatPanel.tsx in Task 7;
// Task 8 added the sidebar (src/components/ChatSidebar.tsx); Task 9 wires
// the active chat id via `?c=` (validated by `validateSearch` above) so
// `/gigi?c=<id>` deep-links straight into a conversation.
