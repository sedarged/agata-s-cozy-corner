import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { Sparkles, Send, Loader2, LogIn } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { useAuth } from "@/lib/auth-context";

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

function Gigi() {
  const { user, session, supabaseAvailable, loading: authLoading } = useAuth();
  const [messages, setMessages] = useState<Msg[]>([WELCOME]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, busy]);

  async function send(text: string) {
    const t = text.trim();
    if (!t || busy) return;
    setError(null);

    const token = session?.access_token;
    if (!token) {
      setError("Zaloguj się, aby porozmawiać z Gigi.");
      return;
    }

    const userMsg: Msg = { id: `u-${Date.now()}`, role: "user", content: t };
    const history = [...messages, userMsg]
      .filter((m) => m.id !== "welcome")
      .map((m) => ({ role: m.role, content: m.content }));
    setMessages((m) => [...m, userMsg]);
    setInput("");
    setBusy(true);

    const aId = `a-${Date.now()}`;
    setMessages((m) => [...m, { id: aId, role: "assistant", content: "" }]);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ messages: history }),
      });

      if (res.status === 401) {
        setError("Twoja sesja wygasła. Zaloguj się ponownie, aby rozmawiać z Gigi.");
        setMessages((m) => m.filter((x) => x.id !== aId));
        return;
      }
      if (res.status === 503) {
        const reason = (await res.text()) || "Gigi nie jest jeszcze skonfigurowana.";
        setError(reason);
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
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        acc += decoder.decode(value, { stream: true });
        setMessages((m) => m.map((x) => (x.id === aId ? { ...x, content: acc } : x)));
      }
      if (!acc.trim()) {
        setMessages((m) => m.filter((x) => x.id !== aId));
        setError("Gigi nie odpowiedziała tym razem. Spróbuj ponownie.");
      }
    } catch {
      setMessages((m) => m.filter((x) => x.id !== aId));
      setError("Brak połączenia z Gigi. Sprawdź sieć i spróbuj ponownie.");
    } finally {
      setBusy(false);
    }
  }

  const canChat = supabaseAvailable && !!user;
  const inputDisabled = busy || !canChat;

  return (
    <div className="flex flex-col h-[100dvh] min-h-0">
      <PageHeader
        title={
          <span className="flex items-center gap-2">
            Gigi <Sparkles className="w-6 h-6 text-rose" aria-hidden />
          </span>
        }
        subtitle="Twoja prywatna towarzyszka czytania."
      />
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
        {!authLoading && !canChat ? (
          <div className="flex flex-col items-center gap-3 p-4 bg-card rounded-2xl border border-border text-center">
            <p className="text-sm text-warm-muted">
              {supabaseAvailable
                ? "Zaloguj się, aby rozmawiać z Gigi o swojej bibliotece i notatkach."
                : "Gigi wymaga połączenia z Twoim kontem. Skonfiguruj Supabase, aby ją włączyć."}
            </p>
            {supabaseAvailable && (
              <Link
                to="/auth"
                className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary text-primary-foreground text-sm"
              >
                <LogIn className="w-4 h-4" aria-hidden />
                Zaloguj się
              </Link>
            )}
          </div>
        ) : (
          <>
            <div className="flex gap-2 overflow-x-auto pb-2 no-scrollbar">
              {prompts.map((p) => (
                <button
                  key={p}
                  onClick={() => send(p)}
                  disabled={inputDisabled}
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
                disabled={inputDisabled}
              />
              <button
                type="submit"
                disabled={inputDisabled || !input.trim()}
                aria-label="Wyślij"
                className="w-10 h-10 rounded-full bg-primary text-primary-foreground grid place-items-center disabled:opacity-50"
              >
                {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
