import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { Sparkles, Send, Loader2 } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/gigi")({
  head: () => ({
    meta: [
      { title: "Gigi — Agata" },
      {
        name: "description",
        content: "Twoja prywatna towarzyszka czytania. Rozmawiaj o książkach, notatkach i cytatach.",
      },
    ],
  }),
  component: Gigi,
});

type Msg = { id: string; role: "user" | "assistant"; content: string };

const prompts = [
  "Poleć mi książkę",
  "Streszcz moje notatki",
  "Co przeczytać dalej?",
  "Pomóż wybrać kolejną książkę",
];

const WELCOME: Msg = {
  id: "welcome",
  role: "assistant",
  content:
    "Cześć, tu Gigi. Co dziś chodzi Ci po głowie? Mogę polecić książkę, pomóc Ci spojrzeć na notatki świeżym okiem albo po prostu porozmawiać o tym, co czytasz.",
};

function Gigi() {
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
    const userMsg: Msg = { id: `u-${Date.now()}`, role: "user", content: t };
    const next = [...messages, userMsg];
    setMessages(next);
    setInput("");
    setBusy(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setMessages((m) => [
          ...m,
          {
            id: `a-${Date.now()}`,
            role: "assistant",
            content:
              "Żeby rozmawiać ze mną prywatnie i z dostępem do Twoich notatek, zaloguj się w ustawieniach. Na razie działam tylko w trybie demonstracyjnym.",
          },
        ]);
        return;
      }

      const res = await fetch("/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          messages: next.map((m) => ({
            id: m.id,
            role: m.role,
            parts: [{ type: "text", text: m.content }],
          })),
        }),
      });

      if (!res.ok || !res.body) {
        throw new Error(`Chat ${res.status}`);
      }

      // Stream UI message protocol: concatenate text-delta events.
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";
      let acc = "";
      const assistantId = `a-${Date.now()}`;
      setMessages((m) => [...m, { id: assistantId, role: "assistant", content: "" }]);

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        const lines = buf.split("\n");
        buf = lines.pop() ?? "";
        for (const line of lines) {
          const s = line.trim();
          if (!s.startsWith("data:")) continue;
          const json = s.slice(5).trim();
          if (!json || json === "[DONE]") continue;
          try {
            const ev = JSON.parse(json);
            const delta =
              (ev.type === "text-delta" && (ev.delta ?? ev.textDelta)) ||
              (ev.type === "text" && ev.text) ||
              "";
            if (delta) {
              acc += delta;
              setMessages((m) =>
                m.map((msg) => (msg.id === assistantId ? { ...msg, content: acc } : msg)),
              );
            }
          } catch {
            // ignore non-JSON keepalives
          }
        }
      }
      if (!acc) {
        setMessages((m) =>
          m.map((msg) =>
            msg.id === assistantId
              ? { ...msg, content: "Hmm, nic mi nie przyszło do głowy — spróbuj jeszcze raz." }
              : msg,
          ),
        );
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Coś poszło nie tak.");
    } finally {
      setBusy(false);
    }
  }

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
    </div>
  );
}
