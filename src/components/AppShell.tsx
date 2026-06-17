import { Link, useRouterState } from "@tanstack/react-router";
import { Home, Library, Plus, NotebookPen, Sparkles, BookOpen, Quote, ListTree, BarChart3, Heart, Palette, Settings, X, Camera, FileText, Image as ImageIcon, Timer } from "lucide-react";
import { useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";

const sidebarItems = [
  { to: "/", label: "Dla Ciebie", icon: Home },
  { to: "/library", label: "Biblioteka", icon: Library },
  { to: "/read", label: "Czytanie", icon: Timer },
  { to: "/notes", label: "Notatki", icon: NotebookPen },
  { to: "/quotes", label: "Cytaty", icon: Quote },
  { to: "/chapters", label: "Rozdziały", icon: ListTree },
  { to: "/recommendations", label: "Rekomendacje", icon: Heart },
  { to: "/statistics", label: "Statystyki", icon: BarChart3 },
  { to: "/gigi", label: "Gigi", icon: Sparkles },
  { to: "/themes", label: "Motywy", icon: Palette },
  { to: "/settings", label: "Ustawienia", icon: Settings },
];

const bottomItems = [
  { to: "/", label: "Dla Ciebie", icon: Home },
  { to: "/library", label: "Biblioteka", icon: Library },
  { to: "__plus", label: "", icon: Plus },
  { to: "/notes", label: "Notatki", icon: NotebookPen },
  { to: "/gigi", label: "Gigi", icon: Sparkles },
] as const;

export function AppShell({ children }: { children: ReactNode }) {
  const [quickOpen, setQuickOpen] = useState(false);
  const pathname = useRouterState({ select: s => s.location.pathname });




  return (
    <div className="min-h-screen flex w-full">
      {/* iPad / desktop sidebar */}
      <aside className="hidden lg:flex flex-col w-60 shrink-0 border-r border-border bg-card/60 backdrop-blur sticky top-0 h-screen">
        <Link to="/" className="px-6 py-6 flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-primary grid place-items-center text-primary-foreground font-serif italic">A</div>
          <div>
            <div className="font-serif text-xl leading-none">Agata</div>
            <div className="text-[10px] text-muted-foreground tracking-widest uppercase mt-0.5">Prywatna biblioteka</div>
          </div>
        </Link>
        <nav className="flex-1 overflow-y-auto px-3 pb-6 space-y-0.5">
          {sidebarItems.map(item => {
            const active = pathname === item.to || (item.to !== "/" && pathname.startsWith(item.to));
            const Icon = item.icon;
            return (
              <Link key={item.to} to={item.to} className={cn("flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors", active ? "bg-primary text-primary-foreground" : "text-foreground hover:bg-muted")}>
                <Icon className="w-4 h-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="p-4 border-t border-border text-[11px] text-muted-foreground">
          Wszystko jest prywatne 🔒
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 min-w-0 pb-24 lg:pb-0">
        {children}
      </main>

      {/* Mobile bottom nav */}
      <nav className="lg:hidden fixed bottom-0 inset-x-0 z-40 bg-card/95 backdrop-blur border-t border-border">
        <div className="grid grid-cols-5 items-end max-w-md mx-auto px-2 pt-1 pb-[max(0.5rem,env(safe-area-inset-bottom))]">
          {bottomItems.map((item, i) => {
            const Icon = item.icon;
            if (item.to === "__plus") {
              return (
                <button key={i} onClick={() => setQuickOpen(true)} className="flex justify-center -mt-6">
                  <span className="w-14 h-14 rounded-full bg-primary text-primary-foreground grid place-items-center shadow-warm">
                    <Plus className="w-6 h-6" />
                  </span>
                </button>
              );
            }
            const active = pathname === item.to || (item.to !== "/" && pathname.startsWith(item.to));
            return (
              <Link key={item.to} to={item.to} className={cn("flex flex-col items-center gap-1 py-2 text-[10px]", active ? "text-primary" : "text-muted-foreground")}>
                <Icon className="w-5 h-5" />
                {item.label}
              </Link>
            );
          })}
        </div>
      </nav>

      {/* Quick actions sheet */}
      {quickOpen && (
        <div className="fixed inset-0 z-50 flex items-end lg:items-center justify-center bg-foreground/40 backdrop-blur-sm" onClick={() => setQuickOpen(false)}>
          <div className="bg-card w-full lg:max-w-md rounded-t-3xl lg:rounded-3xl p-6 pb-10 space-y-3 animate-in slide-in-from-bottom" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-serif text-xl">Szybkie dodawanie</h3>
              <button onClick={() => setQuickOpen(false)} className="p-2 rounded-full hover:bg-muted"><X className="w-4 h-4"/></button>
            </div>
            {[
              { to: "/add-book", icon: BookOpen, label: "Dodaj książkę", desc: "Wyszukaj lub wpisz ISBN" },
              { to: "/note/new?type=quote", icon: Quote, label: "Dodaj cytat", desc: "Zapisz piękny fragment" },
              { to: "/note/new?type=note", icon: FileText, label: "Dodaj notatkę", desc: "Zapisz myśl" },
              { to: "/note/new?type=page-photo", icon: Camera, label: "Zdjęcie strony", desc: "Uchwyć stronę" },
              { to: "/read", icon: Timer, label: "Zacznij sesję czytania", desc: "Tryb skupienia z timerem" },
              { to: "/notebook", icon: ImageIcon, label: "Otwórz notes", desc: "Tryb iPad / płótno" },
            ].map(a => (
              <Link key={a.to} to={a.to} onClick={() => setQuickOpen(false)} className="flex items-center gap-4 p-4 rounded-2xl bg-muted hover:bg-accent transition">
                <div className="w-11 h-11 rounded-xl bg-primary text-primary-foreground grid place-items-center"><a.icon className="w-5 h-5"/></div>
                <div className="flex-1 min-w-0">
                  <div className="font-medium">{a.label}</div>
                  <div className="text-xs text-muted-foreground">{a.desc}</div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
