import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/PageHeader";
import { useTheme } from "@/lib/theme-context";
import { Check, Moon, Sun } from "lucide-react";

export const Route = createFileRoute("/themes")({
  head: () => ({ meta: [{ title: "Motywy — Agata" }] }),
  component: Themes,
});

const modes = [
  { id: "light" as const, label: "Jasny", desc: "Ciepła kremowa biblioteka w dziennym świetle.", icon: Sun, swatch: ["#fbf7f1", "#eadcc8", "#c9a469"] },
  { id: "dark" as const, label: "Ciemny", desc: "Espresso i bursztynowe światło wieczorem.", icon: Moon, swatch: ["#1c1713", "#2a201a", "#d3a76a"] },
];

function Themes() {
  const { mode, setMode } = useTheme();
  return (
    <div>
      <PageHeader title="Motyw" subtitle="Wybierz światło dla swojej biblioteki." />
      <div className="px-5 lg:px-10 grid grid-cols-1 sm:grid-cols-2 gap-5 pb-12 max-w-3xl">
        {modes.map((t) => {
          const active = mode === t.id;
          const Icon = t.icon;
          return (
            <button
              key={t.id}
              onClick={() => setMode(t.id)}
              className="text-left glass p-5 rounded-3xl hover:scale-[1.01] transition relative"
            >
              <div
                className="aspect-[16/9] rounded-2xl p-4 flex flex-col justify-between"
                style={{ background: `linear-gradient(160deg, ${t.swatch[0]}, ${t.swatch[1]})` }}
              >
                <div className="font-script text-2xl" style={{ color: t.swatch[2] }}>Agata</div>
                <div className="self-end rounded-full px-3 py-1 text-[10px]" style={{ background: t.swatch[2], color: t.swatch[0] }}>
                  Moja biblioteka
                </div>
              </div>
              <div className="mt-4 flex items-center gap-2">
                <Icon className="w-4 h-4 gold-text" />
                <div className="font-serif text-xl text-warm">{t.label}</div>
                {active && (
                  <span className="ml-auto w-6 h-6 rounded-full grid place-items-center" style={{ background: "var(--accent-gold)", color: "var(--bg)" }}>
                    <Check className="w-3.5 h-3.5" />
                  </span>
                )}
              </div>
              <div className="text-sm text-warm-muted mt-1">{t.desc}</div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
