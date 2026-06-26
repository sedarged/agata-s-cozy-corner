import { useEffect, useMemo, useRef, useState } from "react";
import { Send, Loader2 } from "lucide-react";
import { useAppendMessageMutation, useChatQuery } from "@/lib/api/client";

// ChatPanel — the Gigi chat surface, extracted from the inline `GigiChat`
// in src/routes/gigi.tsx so the route can swap conversations via the
// sidebar (Task 8) without re-mounting the composer.
//
// Responsibilities:
//   - Read persisted history via `useChatQuery(chatId)` when `chatId` is set.
//   - Inject a synthetic WELCOME message on top of an empty conversation
//     (and when `chatId` is null, i.e. no active conversation yet).
//   - Stream replies from `/api/chat` with a per-fetch AbortController so
//     a navigation or a new send cancels the in-flight reader cleanly.
//   - Persist the assistant message via `useAppendMessageMutation` after
//     the stream completes (the server-side /api/chat already wrote it
//     fire-and-forget, but the React Query invalidation triggers a refetch
//     so the UI shows the persisted bubble without a manual reload).
//
// What it does NOT do:
//   - Build the `/api/chat` context from books/notes/privacyLevel — the
//     route already owns that via `buildContext`, and it forwards the
//     shape straight through. Keeping that boundary means the panel can
//     be reused unchanged when the chat-history feature grows.

type Msg = { id: string; role: "user" | "assistant"; content: string };

const WELCOME: Msg = {
  id: "welcome",
  role: "assistant",
  content:
    "Cześć, tu Gigi — Twoja prywatna towarzyszka czytania. Znam Twoją bibliotekę i notatki. " +
    "O czym dziś porozmawiamy?",
};

const prompts = [
  "Poleć mi książkę",
  "Streść moje notatki",
  "Co przeczytać dalej?",
  "Pomóż wybrać kolejną książkę",
];

export default function ChatPanel({
  chatId,
  privacyLevel,
  books,
  notes,
  context,
}: {
  chatId: string | null;
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
  // Pre-built `/api/chat` context (already includes privacyLevel/books/notes
  // shaping). The route does this so the panel doesn't need to know about
  // the privacy-level mapping table.
  context: unknown;
}) {
  // Persisted history from the server. When `chatId` is null the query is
  // disabled and `data` is undefined — we fall back to an empty list and
  // inject WELCOME below.
  const chatQuery = useChatQuery(chatId);
  // Memoize so the `useEffect` dep below doesn't fire on every render
  // (React Query returns a fresh array reference when data is unset).
  const persisted = useMemo(() => chatQuery.data?.messages ?? [], [chatQuery.data]);

  // Local view-model messages. The user bubble and the streaming assistant
  // bubble are appended here so the UI updates immediately; on success we
  // invalidate `qk.chat(chatId)` via `useAppendMessageMutation` so the next
  // render pulls the persisted state from the server.
  const [messages, setMessages] = useState<Msg[]>(() =>
    persisted.length === 0 ? [WELCOME] : persisted,
  );
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  // Holds the AbortController for the in-flight streaming request. Used to
  // cancel the fetch when the component unmounts (or when a new send() is
  // dispatched) so the reader loop doesn't keep consuming bytes and calling
  // setState on a dead component. Critical — see CLAUDE.md.
  const abortRef = useRef<AbortController | null>(null);

  const appendMessage = useAppendMessageMutation();

  // When the server-persisted message list changes (e.g. after the panel
  // re-mounts on a different chatId, or after an explicit invalidation),
  // reflect it in the local view. We only merge server messages we don't
  // already have locally — the in-flight assistant bubble has a different
  // id (a-{uuid}) than the persisted one, so they don't collide.
  useEffect(() => {
    if (persisted.length === 0) {
      setMessages((m) => (m.length === 0 || m[0]?.id === "welcome" ? [WELCOME] : m));
      return;
    }
    setMessages((m) => {
      const knownIds = new Set(m.map((x) => x.id));
      const merged = [...m];
      for (const p of persisted) {
        if (!knownIds.has(p.id)) {
          merged.push({ id: p.id, role: p.role, content: p.content });
        }
      }
      return merged;
    });
  }, [persisted]);

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
    // Strip the synthetic WELCOME marker so the model never sees "assistant:
    // Cześć…" as a real turn — matches the existing behaviour.
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
          chatId, // null when no active conversation — server creates one
          messages: history,
          context,
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
        return;
      }

      // Stream completed successfully — invalidate the persisted message
      // cache via React Query so the next render reflects the server-side
      // write. The /api/chat handler already persisted the assistant
      // message fire-and-forget; the mutation here is a no-op on the
      // server (it'd 409 / dedupe) — we only call it to trigger the
      // onSuccess invalidation path. Guarded to only run when chatId is
      // set; otherwise there's nothing to invalidate.
      if (chatId) {
        appendMessage.mutate({ chatId, role: "assistant", content: acc });
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

  // Unused-but-pinned props keep the API consistent with the GigiChat it
  // replaced: the route forwards privacyLevel/books/notes for the
  // buildContext call (now done in the route, see `<ChatPanel context={...} />`).
  void privacyLevel;
  void books;
  void notes;

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
