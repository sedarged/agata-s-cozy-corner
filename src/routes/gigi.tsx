import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { Sparkles, Send, Loader2 } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";

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
  "Streszcz moje notatki",
  "Co przeczytać dalej?",
  "Pomóż wybrać kolejną książkę",
];

const WELCOME: Msg = {
  id: "welcome",
  role: "assistant",
  content:
    "Cześć, tu Gigi. Na razie jestem w wersji zapowiedzi — wkrótce podłączę się do Twojego modelu i będę znała całą Twoją bibliotekę i notatki. Już teraz możemy jednak pogadać o czytaniu.",
};

// Mock companion until Gigi is connected to the real model (planned: your
// personal ChatGPT via OAuth). No login, no network — warm canned replies.
const SOON = "\n\n(Pełna Gigi — z dostępem do Twoich książek i notatek — już wkrótce.)";

function mockReply(text: string): string {
  const t = text.toLowerCase();
  if (/(poleć|polec|rekomend|co przeczytać|przeczytać dalej|wybrać|wybierz)/.test(t)) {
    return (
      "Z przyjemnością! Gdy będę już podłączona do Twojej biblioteki, dobiorę tytuł do Twojego nastroju i ocen. " +
      "Na razie podpowiem klasycznie: jeśli chcesz czegoś ciepłego i refleksyjnego — sięgnij po coś z Twojej półki „W kolejce”." +
      SOON
    );
  }
  if (/(notatk|streszcz|cytat|podsumuj)/.test(t)) {
    return (
      "Kiedy połączę się z Twoimi notatkami, zbiorę z nich najważniejsze myśli i powtarzające się wątki. " +
      "Tymczasem zajrzyj do zakładki Notatki — wszystkie cytaty i rozdziały masz tam w jednym miejscu." +
      SOON
    );
  }
  return (
    "Słyszę Cię. Niedługo będę mogła odpowiadać pełnymi myślami na podstawie tego, co czytasz. " +
    "Opowiedz mi, nad czym teraz się zastanawiasz przy lekturze?" +
    SOON
  );
}

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
    setMessages((m) => [...m, userMsg]);
    setInput("");
    setBusy(true);

    // Local mock companion — no login, no network. Real model arrives later.
    const reply = mockReply(t);
    await new Promise((r) => setTimeout(r, 500));
    setMessages((m) => [...m, { id: `a-${Date.now()}`, role: "assistant", content: reply }]);
    setBusy(false);
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
