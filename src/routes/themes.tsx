import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/PageHeader";
import { useTheme, themes } from "@/lib/theme-context";
import { Check } from "lucide-react";

export const Route = createFileRoute("/themes")({
  head: () => ({ meta: [{ title: "Motywy — Agata" }] }),
  component: Themes,
});

function Themes() {
  const { theme, setTheme } = useTheme();
  return (
    <div>
      <PageHeader title="Motywy" subtitle="Zmień wygląd i nastrój aplikacji."/>
      <div className="px-5 lg:px-10 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4 pb-12">
        {themes.map(t => {
          const active = theme === t.id;
          return (
            <button key={t.id} onClick={() => setTheme(t.id)} className="text-left">
              <div className="rounded-3xl overflow-hidden shadow-soft" style={{ background: t.swatch[0] }}>
                <div className="aspect-[3/5] p-3 relative" style={{ background: `linear-gradient(160deg, ${t.swatch[0]}, ${t.swatch[1]})` }}>
                  <div className="text-[8px] font-serif" style={{ color: t.swatch[2] }}>Dla Ciebie ✨</div>
                  <div className="mt-2 rounded-md p-2" style={{ background: t.swatch[0], color: t.swatch[2] }}>
                    <div className="text-[7px] font-bold">FOURTH WING</div>
                    <div className="h-1 rounded-full mt-1.5" style={{ background: t.swatch[2], opacity: 0.4 }}>
                      <div className="h-full w-2/3 rounded-full" style={{ background: t.swatch[2] }}/>
                    </div>
                  </div>
                  <div className="mt-2 rounded-md p-1.5" style={{ background: t.swatch[1], color: t.swatch[0] }}>
                    <div className="text-[6px]">Gigi poleca</div>
                  </div>
                  {active && <div className="absolute top-2 right-2 w-5 h-5 rounded-full bg-primary text-primary-foreground grid place-items-center"><Check className="w-3 h-3"/></div>}
                </div>
              </div>
              <div className="mt-2 text-center text-sm font-medium">{t.label}</div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
