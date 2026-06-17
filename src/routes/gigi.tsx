import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { initialGigiMessages, type GigiMessage } from "@/lib/mock-data";
import { Sparkles, Send } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";

export const Route = createFileRoute("/gigi")({
  head: () => ({ meta: [{ title: "Gigi — Agata" }] }),
  component: Gigi,
});

const prompts = [
  "Poleć książkę",
  "Streszcz moje notatki",
  "Porozmawiajmy o tym cytacie",
  "Pomóż mi ocenić tę książkę",
  "Znajdź notatki o emocjach",
  "Co przeczytać dalej?",
];

const replies = [
  "Na podstawie Twoich ulubionych tematów — emocji, lojalności i powolnego romansu — może Ci się spodobać „Niewidzialne życie Addie LaRue". To 95% dopasowanie.",
  "Wyciągnęłam 12 notatek, które zapisałaś w tym miesiącu. Trzy wzorce: siła pod presją, lojalność w ogniu i koszt wyboru. Mam ułożyć z tego refleksję?",
  "Powiedz mi więcej, co Cię uderzyło w tym cytacie — rytm zdania czy uczucie pod spodem?",
];

function Gigi() {
  const [messages, setMessages] = useState<GigiMessage[]>(initialGigiMessages);
  const [input, setInput] = useState("");

  function send(text: string) {
    if (!text.trim()) return;
    const u: GigiMessage = { id: String(Date.now()), role: "user", content: text };
    setMessages(m => [...m, u]);
    setInput("");
    setTimeout(() => {
      const g: GigiMessage = { id: String(Date.now()+1), role: "gigi", content: replies[Math.floor(Math.random()*replies.length)] };
      setMessages(m => [...m, g]);
    }, 700);
  }

  return (
    <div className="flex flex-col h-[calc(100vh-0px)] lg:h-screen">
      <PageHeader title={<span className="flex items-center gap-2">Gigi <Sparkles className="w-6 h-6 text-rose"/></span>} subtitle="Twoja prywatna towarzyszka czytania."/>
      <div className="flex-1 overflow-y-auto px-5 lg:px-10 pb-4 max-w-3xl w-full mx-auto space-y-4">
        {messages.map(m => (
          <div key={m.id} className={`flex gap-3 ${m.role === "user" ? "justify-end" : ""}`}>
            {m.role === "gigi" && <div className="w-9 h-9 rounded-full bg-gradient-to-br from-rose to-primary text-primary-foreground grid place-items-center font-serif italic shrink-0">G</div>}
            <div className={`max-w-[80%] px-4 py-3 rounded-2xl text-sm ${m.role === "user" ? "bg-primary text-primary-foreground rounded-br-sm" : "bg-card rounded-tl-sm shadow-soft"}`}>
              {m.content}
            </div>
          </div>
        ))}
      </div>
      <div className="px-5 lg:px-10 pb-4 max-w-3xl w-full mx-auto">
        <div className="flex gap-2 overflow-x-auto pb-2 no-scrollbar">
          {prompts.map(p => (
            <button key={p} onClick={() => send(p)} className="shrink-0 px-3 py-1.5 rounded-full bg-card border border-border text-xs hover:bg-muted">{p}</button>
          ))}
        </div>
        <form onSubmit={e => { e.preventDefault(); send(input); }} className="mt-2 flex items-center gap-2 p-2 bg-card rounded-full border border-border shadow-soft">
          <input value={input} onChange={e => setInput(e.target.value)} placeholder="Zapytaj Gigi o cokolwiek…" className="flex-1 bg-transparent px-4 py-2 text-sm focus:outline-none"/>
          <button className="w-10 h-10 rounded-full bg-primary text-primary-foreground grid place-items-center"><Send className="w-4 h-4"/></button>
        </form>
      </div>
    </div>
  );
}
