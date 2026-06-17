import { Link, useRouterState } from "@tanstack/react-router";
import {
  Home, Library, NotebookPen, Sparkles, Quote, ListTree, BarChart3,
  Heart, Palette, Settings, Bell, UserRound, Menu, X, BookOpen, Camera,
  FileText, Image as ImageIcon, Timer,
} from "lucide-react";
import { useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { ThemeToggle } from "@/components/ThemeToggle";

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
  { to: "/themes", label: "Motyw", icon: Palette },
  { to: "/settings", label: "Ustawienia", icon: Settings },
] as const;

const drawerLinks = [
  { to: "/library", icon: Library, label: "Biblioteka" },
  { to: "/notes", icon: NotebookPen, label: "Notatki" },
  { to: "/quotes", icon: Quote, label: "Cytaty" },
  { to: "/recommendations", icon: Heart, label: "Rekomendacje" },
  { to: "/statistics", icon: BarChart3, label: "Statystyki" },
  { to: "/gigi", icon: Sparkles, label: "Gigi" },
  { to: "/themes", icon: Palette, label: "Motyw" },
  { to: "/settings", icon: Settings, label: "Ustawienia" },
  { to: "/add-book", icon: BookOpen, label: "Dodaj książkę" },
  { to: "/note/new?type=quote", icon: Quote, label: "Dodaj cytat" },
  { to: "/note/new?type=note", icon: FileText, label: "Dodaj notatkę" },
  { to: "/note/new?type=page-photo", icon: Camera, label: "Zdjęcie strony" },
  { to: "/read", icon: Timer, label: "Sesja czytania" },
  { to: "/notebook", icon: ImageIcon, label: "Notes (iPad)" },
] as const;

export function AppShell({ children }: { children: ReactNode }) {
  const [drawer, setDrawer] = useState(false);
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  return (
    <div className="min-h-screen flex w-full relative">
      <div className="ambient-bg" aria-hidden />

      {/* iPad / desktop sidebar */}
      <aside className="hidden lg:flex flex-col w-60 shrink-0 sticky top-0 h-screen p-4">
        <div className="glass rounded-3xl flex-1 flex flex-col p-3">
          <Link to="/" className="px-3 py-4 flex flex-col items-center">
            <div className="font-script text-3xl gold-text leading-none">Agata</div>
            <div className="text-[10px] text-warm-muted tracking-[0.25em] uppercase mt-1">Prywatna biblioteka</div>
          </Link>
          <nav className="flex-1 overflow-y-auto px-1 pb-3 space-y-0.5">
            {sidebarItems.map((item) => {
              const active = pathname === item.to || (item.to !== "/" && pathname.startsWith(item.to));
              const Icon = item.icon;
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  className={cn(
                    "flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-colors",
                    active ? "bg-[var(--accent-gold)] text-[var(--bg)]" : "text-warm hover:bg-[var(--glass-inner)]",
                  )}
                >
                  <Icon className="w-4 h-4" />
                  {item.label}
                </Link>
              );
            })}
          </nav>
          <div className="p-3 border-t border-[var(--glass-border)] flex items-center justify-between">
            <span className="text-[11px] text-warm-muted">Wszystko prywatne</span>
            <ThemeToggle />
          </div>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 min-w-0">
        {/* Top header */}
        <header className="sticky top-0 z-30 px-4 lg:px-8 pt-4 pb-2">
          <div className="flex items-center justify-between gap-3 glass-pill px-3 py-2">
            <button
              onClick={() => setDrawer(true)}
              className="lg:hidden w-9 h-9 grid place-items-center rounded-full hover:bg-[var(--glass-inner)] text-warm"
              aria-label="Menu"
            >
              <UserRound className="w-4 h-4 gold-text" />
            </button>
            <Link to="/" className="flex-1 text-center flex items-center justify-center gap-2">
              <span className="font-script text-3xl gold-text leading-none">Agata</span>
              <svg width="22" height="14" viewBox="0 0 22 14" className="opacity-80 gold-text" aria-hidden>
                <path d="M1 7 Q 6 1 11 7 T 21 7" stroke="currentColor" strokeWidth="0.8" fill="none" />
                <circle cx="14" cy="6" r="1.2" fill="currentColor" />
                <circle cx="17" cy="4" r="0.9" fill="currentColor" />
                <circle cx="19" cy="8" r="0.7" fill="currentColor" />
              </svg>
            </Link>
            <button
              className="w-9 h-9 grid place-items-center rounded-full hover:bg-[var(--glass-inner)] text-warm"
              aria-label="Powiadomienia"
            >
              <Bell className="w-4 h-4 gold-text" />
            </button>
            <div className="hidden sm:block">
              <ThemeToggle />
            </div>
            <button
              onClick={() => setDrawer(true)}
              className="lg:hidden w-9 h-9 grid place-items-center rounded-full hover:bg-[var(--glass-inner)] text-warm"
              aria-label="Otwórz menu"
            >
              <Menu className="w-4 h-4 gold-text" />
            </button>
          </div>
        </header>

        {children}
      </main>

      {/* Mobile drawer */}
      {drawer && (
        <div
          className="lg:hidden fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex justify-end"
          onClick={() => setDrawer(false)}
        >
          <div
            className="w-72 h-full glass-strong p-5 overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <span className="font-script text-2xl gold-text">Agata</span>
              <button
                onClick={() => setDrawer(false)}
                className="w-9 h-9 grid place-items-center rounded-full hover:bg-[var(--glass-inner)] text-warm"
                aria-label="Zamknij"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <nav className="space-y-1">
              {drawerLinks.map((l) => (
                <Link
                  key={l.to}
                  to={l.to}
                  onClick={() => setDrawer(false)}
                  className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-warm hover:bg-[var(--glass-inner)]"
                >
                  <l.icon className="w-4 h-4 gold-text" />
                  {l.label}
                </Link>
              ))}
            </nav>
            <div className="mt-4 pt-4 border-t border-[var(--glass-border)] flex items-center justify-between">
              <span className="text-xs text-warm-muted">Motyw</span>
              <ThemeToggle />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
