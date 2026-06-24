import { createFileRoute } from "@tanstack/react-router";
import { Link } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { Sparkles, Send, Loader2, Settings as SettingsIcon, Loader } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { ChatGPTConnectCard } from "@/components/ChatGPTConnectCard";
import {
  useBooksQuery,
  useNotesQuery,
  useSettingQuery,
  useChatgptStatusQuery,
} from "@/lib/api/client";
import { getGigiViewState } from "./gigi-view-state";

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

type Msg = { id: string; role: "user" | "assistant"; content: string };

const GIGI_DEFAULT_LEVEL = "Cała biblioteka + rozmowy";

const prompts = [
  "Poleć mi książkę",
  "Streść moje notatki",
  "Co przeczytać dalej?",
  "Pomóż wybrać kolejną książkę",
];

const WELCOME: Msg = {
  id: "welcome",
  role: "assistant",
  content:
    "Cześć, tu Gigi — Twoja prywatna towarzyszka czytania. Znam Twoją bibliotekę i notatki. " +
    "O czym dziś porozmawiamy?",
};

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
  const chatgptStatusQuery = useChatgptStatusQuery();
  const privacyLevel = useMemo(() => {
    const value = privacySetting?.value;
    return typeof value === "string" && value.length > 0 ? value : GIGI_DEFAULT_LEVEL;
  }, [privacySetting]);

  // Pure decision — see src/routes/gigi-view-state.spec.ts. Three branches:
  //   "loading"     — chatgpt status still in flight → spinner
  //   "needs-oauth" — known disconnected (or query errored) → render
  //                   <ChatGPTConnectCard />, suppress the chat composer
  //                   so the user can't type into a dead input
  //   "ready"       — connected → render the full chat UI
  //
  // Code-review W1 (2026-06-24): on `isError` we fall back to
  // "needs-oauth" rather than staying on the spinner. The OAuth gate
  // has its own retry/connect flows, so it's a safer recovery path
  // than a perpetual loading state.
  const viewState = getGigiViewState({
    status: chatgptStatusQuery.data,
    isError: chatgptStatusQuery.isError,
  });

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
      {viewState === "loading" && <GigiLoading />}
      {viewState === "needs-oauth" && <GigiOAuthGate />}
      {viewState === "ready" && (
        <GigiChat privacyLevel={privacyLevel} books={books} notes={notes} />
      )}
    </div>
  );
}

// Inline loading state — the chatgpt status is a cheap GET, but on slow
// links we don't want to flash the OAuth gate. A tiny inline spinner is
// enough; the existing topbar / sidebar are still interactive.
function GigiLoading() {
  return (
    <div className="flex-1 grid place-items-center text-warm-muted">
      <div className="flex items-center gap-2 text-sm">
        <Loader className="w-4 h-4 animate-spin" aria-hidden />
        Sprawdzam połączenie z ChatGPT…
      </div>
    </div>
  );
}

// OAuth-first landing — rendered when /api/chatgpt/status says
// `connected: false`. We render the existing ChatGPTConnectCard (which
// has its own browser-OAuth + paste-the-URL flows + disconnect) and a
// one-liner pointing at Settings for the more advanced privacy controls.
// The chat composer is intentionally NOT rendered here so the user
// can't fire a /api/chat call that would just 503.
function GigiOAuthGate() {
  return (
    <div className="flex-1 overflow-y-auto px-4 sm:px-5 lg:px-10 pb-[max(1rem,env(safe-area-inset-bottom))] max-w-3xl w-full mx-auto space-y-6">
      <div className="text-center space-y-2 pt-2">
        <p className="font-serif text-xl text-warm">Gigi czeka na połączenie z ChatGPT</p>
        <p className="text-sm text-warm-muted">
          Połącz swoje konto ChatGPT (subskrypcja Plus/Pro), aby zacząć rozmawiać.
        </p>
      </div>
      <ChatGPTConnectCard />
      <p className="text-xs text-warm-muted text-center">
        Potrzebujesz czegoś więcej?{" "}
        <Link to="/settings" className="underline underline-offset-2 hover:text-warm">
          Otwórz Ustawienia
        </Link>{" "}
        — znajdziesz tam m.in. poziom prywatności i opcję rozłączenia.
      </p>
    </div>
  );
}

function GigiChat({
  privacyLevel,
  books,
  notes,
}: {
  privacyLevel: string;
  books: ReadonlyArray<{
    id: string;
    title: string;
    author?: string | null;
    status: string;
    rating?: number | null;
    isFavourite?: boolean;
  }>;
  notes: ReadonlyArray<{
    id: string;
    type: string;
    content?: string | null;
    quoteText?: string | null;
    bookId: string;
  }>;
}) {
  const [messages, setMessages] = useState<Msg[]>([WELCOME]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  // Holds the AbortController for the in-flight streaming request. Used to
  // cancel the fetch when the component unmounts (or when a new send() is
  // dispatched) so the reader loop doesn't keep consuming bytes and calling
  // setState on a dead component.
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, busy]);

  // Cleanup: if the user navigates away mid-stream, abort the fetch so the
  // reader loop terminates promptly and the network connection is released.
  useEffect(() => {
    return () => {
      abortRef.current?.abort();
      abortRef.current = null;
    };
  }, []);

  async function send(text: string) {
    const t = text.trim();
    if (!t || busy) return;
    setError(null);

    const userMsg: Msg = { id: `u-${crypto.randomUUID()}`, role: "user", content: t };
    const history = [...messages, userMsg]
      .filter((m) => m.id !== "welcome")
      .map((m) => ({ role: m.role, content: m.content }));
    setMessages((m) => [...m, userMsg]);
    setInput("");
    setBusy(true);

    const aId = `a-${crypto.randomUUID()}`;
    setMessages((m) => [...m, { id: aId, role: "assistant", content: "" }]);

    // Cancel any previous in-flight request before starting a new one.
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;

    try {
      const gigiKey = (window as { __GIGI_KEY__?: string }).__GIGI_KEY__;
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (gigiKey) headers["x-gigi-key"] = gigiKey;

      const res = await fetch("/api/chat", {
        method: "POST",
        headers,
        body: JSON.stringify({
          messages: history,
          context: buildContext(privacyLevel, books, notes),
        }),
        signal: ctrl.signal,
      });

      if (res.status === 401) {
        setError("Gigi jest zabezpieczona. Sprawdź konfigurację GIGI_SECRET.");
        setMessages((m) => m.filter((x) => x.id !== aId));
        return;
      }
      if (res.status === 503) {
        // Read the body once — consuming it here is safe because we early-return
        // and never reach the `!res.body` check below. Trim to avoid showing a
        // noisy server stack trace in the UI.
        const raw = (await res.text()).trim();
        setError(raw || "Gigi nie jest jeszcze skonfigurowana.");
        setMessages((m) => m.filter((x) => x.id !== aId));
        return;
      }
      if (!res.ok || !res.body) {
        setError("Coś poszło nie tak po stronie Gigi. Spróbuj ponownie za chwilę.");
        setMessages((m) => m.filter((x) => x.id !== aId));
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let acc = "";
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        acc += decoder.decode(value, { stream: true });
        setMessages((m) => m.map((x) => (x.id === aId ? { ...x, content: acc } : x)));
      }
      if (!acc.trim()) {
        setMessages((m) => m.filter((x) => x.id !== aId));
        setError("Gigi nie odpowiedziała tym razem. Spróbuj ponownie.");
      }
    } catch (err) {
      // Silently ignore aborts (user navigated away or sent a new message)
      if (err instanceof DOMException && err.name === "AbortError") return;
      setMessages((m) => m.filter((x) => x.id !== aId));
      setError("Brak połączenia z Gigi. Sprawdź sieć i spróbuj ponownie.");
    } finally {
      if (abortRef.current === ctrl) abortRef.current = null;
      setBusy(false);
    }
  }

  return (
    <>
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto px-4 sm:px-5 lg:px-10 pb-4 max-w-3xl w-full mx-auto space-y-4"
      >
        {messages.map((m) => (
          <div key={m.id} className={`flex gap-3 ${m.role === "user" ? "justify-end" : ""}`}>
            {m.role === "assistant" && (
              <div className="w-9 h-9 rounded-full bg-gradient-to-br from-rose to-primary text-primary-foreground grid place-items-center font-serif italic shrink-0">
                G
              </div>
            )}
            <div
              className={`max-w-[80%] px-4 py-3 rounded-2xl text-sm whitespace-pre-wrap ${
                m.role === "user"
                  ? "bg-primary text-primary-foreground rounded-br-sm"
                  : "bg-card rounded-tl-sm shadow-soft"
              }`}
            >
              {m.content || (busy && m.role === "assistant" ? "…" : "")}
            </div>
          </div>
        ))}
        {busy && (
          <div className="flex gap-3 items-center text-warm-muted text-xs px-1">
            <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden /> Gigi pisze…
          </div>
        )}
        {error && (
          <div className="text-xs text-destructive/90 bg-destructive/10 px-3 py-2 rounded-xl">
            {error}
          </div>
        )}
      </div>
      <div className="px-4 sm:px-5 lg:px-10 pb-[max(1rem,env(safe-area-inset-bottom))] max-w-3xl w-full mx-auto">
        <div className="flex gap-2 overflow-x-auto pb-2 no-scrollbar">
          {prompts.map((p) => (
            <button
              key={p}
              onClick={() => send(p)}
              disabled={busy}
              className="shrink-0 px-3 py-1.5 rounded-full bg-card border border-border text-xs hover:bg-muted disabled:opacity-50"
            >
              {p}
            </button>
          ))}
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            send(input);
          }}
          className="mt-2 flex items-center gap-2 p-2 bg-card rounded-full border border-border shadow-soft"
        >
          <label htmlFor="gigi-input" className="sr-only">
            Wiadomość do Gigi
          </label>
          <input
            id="gigi-input"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Zapytaj Gigi o cokolwiek…"
            className="flex-1 bg-transparent px-4 py-2 text-sm focus:outline-none"
            disabled={busy}
          />
          <button
            type="submit"
            disabled={busy || !input.trim()}
            aria-label="Wyślij"
            className="w-10 h-10 rounded-full bg-primary text-primary-foreground grid place-items-center disabled:opacity-50"
          >
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          </button>
        </form>
      </div>
    </>
  );
}
