import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
// /notebook is an isolated demo canvas page — real per-book notes live under /book/$id/notes.
import {
  Pen,
  Highlighter,
  Eraser,
  Type,
  Image as ImageIcon,
  Palette,
  Layers,
  Sparkles,
  Save,
  ArrowLeft,
} from "lucide-react";

export const Route = createFileRoute("/notebook")({
  head: () => ({ meta: [{ title: "Notes — Agata" }] }),
  component: Notebook,
});

const tools = [Pen, Highlighter, Eraser, Type, ImageIcon, Palette, Layers, Sparkles, Save];
const colors = ["#3a1018", "#8a485a", "#c97a5a", "#d4a878", "#7a9a6a", "#5a7aaa", "#3a3a3a"];

function Notebook() {
  const [color, setColor] = useState(colors[0]);

  return (
    <div className="min-h-screen flex flex-col bg-[oklch(0.95_0.01_60)]">
      <div className="flex items-center justify-between px-5 py-3 bg-card border-b border-border">
        <div className="flex items-center gap-3">
          <Link to="/notes" className="p-2 -ml-2 rounded-full hover:bg-muted">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <div className="font-serif text-lg leading-none">Fourth Wing · Strona 186</div>
            <div className="text-xs text-muted-foreground">Notes · zapisano automatycznie</div>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          {colors.map((c) => (
            <button
              key={c}
              onClick={() => setColor(c)}
              className={`w-6 h-6 rounded-full ring-2 ring-offset-2 ring-offset-card ${color === c ? "ring-foreground" : "ring-transparent"}`}
              style={{ background: c }}
            />
          ))}
        </div>
        <button className="flex items-center gap-2 px-4 py-2 rounded-full bg-primary text-primary-foreground text-sm">
          <Save className="w-4 h-4" />
          Zapisz
        </button>
      </div>

      <div className="flex-1 grid grid-cols-[60px_1fr] lg:grid-cols-[60px_1fr_300px] gap-4 p-4">
        <aside className="bg-card rounded-2xl shadow-soft p-2 flex flex-col gap-1">
          {tools.map((Icon, i) => (
            <button
              key={i}
              className={`w-11 h-11 rounded-xl grid place-items-center hover:bg-muted ${i === 0 ? "bg-primary text-primary-foreground" : ""}`}
            >
              <Icon className="w-4 h-4" />
            </button>
          ))}
        </aside>

        <div
          className="bg-[oklch(0.98_0.015_75)] rounded-2xl shadow-soft p-10 relative overflow-hidden"
          style={{
            backgroundImage:
              "repeating-linear-gradient(transparent, transparent 31px, oklch(0.92 0.02 60) 32px)",
          }}
        >
          <div
            className="font-serif text-3xl"
            style={{ color, fontFamily: "Fraunces, serif", fontStyle: "italic" }}
          >
            Ten fragment mnie złamał.
          </div>
          <blockquote
            className="mt-6 font-serif italic text-lg max-w-md leading-relaxed"
            style={{ color }}
          >
            „Nie wznosisz się na poziom swoich celów. Spadasz do poziomu swoich systemów."
          </blockquote>
          <div className="mt-4 font-serif text-2xl italic" style={{ color: "#8a485a" }}>
            Pamiętaj to zawsze.
          </div>
          <div className="mt-10 text-base italic" style={{ color }}>
            Rozwój Violet to wszystko.
          </div>
          <div className="absolute top-10 right-10 w-44 h-44 rounded-2xl bg-gradient-to-br from-accent to-muted grid place-items-center text-muted-foreground text-xs">
            📷 szkic
          </div>
          <div className="absolute bottom-6 left-10 text-xs text-muted-foreground italic">
            — zacznij pisać piórkiem —
          </div>
        </div>

        <aside className="hidden lg:flex flex-col gap-4">
          <div className="bg-card rounded-2xl p-5 shadow-soft">
            <div className="flex items-center gap-2 mb-3">
              <Sparkles className="w-4 h-4 text-primary" />
              <h3 className="font-serif text-lg">Gigi</h3>
            </div>
            <p className="text-sm text-muted-foreground">Co chciałabyś zrobić?</p>
            <div className="mt-3 space-y-2">
              {[
                "Streszcz to",
                "Wyjaśnij ten cytat",
                "Zaproponuj tag",
                "Pokaż bibliotekę komentarzy",
              ].map((t) => (
                <button
                  key={t}
                  className="w-full text-left px-3 py-2 rounded-xl bg-muted hover:bg-accent text-sm"
                >
                  {t}
                </button>
              ))}
            </div>
          </div>
          <div className="bg-card rounded-2xl p-5 shadow-soft">
            <h3 className="font-serif text-lg mb-3">Właściwości notatki</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Książka</span>
                <span>—</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Strona</span>
                <span>186</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Utworzono</span>
                <span>Dziś</span>
              </div>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
