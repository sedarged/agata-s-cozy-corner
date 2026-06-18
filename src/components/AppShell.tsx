import { Link, useRouterState } from "@tanstack/react-router";
import {
  Home, Library, NotebookPen, Sparkles, Quote, ListTree, BarChart3,
  Heart, Palette, Settings, Bell, UserRound, X, BookOpen, Camera,
  FileText, Image as ImageIcon, Timer, Sun, Moon,
} from "lucide-react";
import { useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { ThemeToggle } from "@/components/ThemeToggle";
import { useTheme } from "@/lib/theme-context";

const sidebarItems = [
  { to: "/", label: "Główna", icon: Home },
  { to: "/library", label: "Biblioteka", icon: Library },
  { to: "/read", label: "Czytanie", icon: Timer },
  { to: "/notes", label: "Notatki", icon: NotebookPen },
  { to: "/quotes", label: "Cytaty", icon: Quote },
  { to: "/chapters", label: "Rozdziały", icon: ListTree },
  { to: "/recommendations", label: "Polecane", icon: Heart },
  { to: "/statistics", label: "Statystyki", icon: BarChart3 },
  { to: "/gigi", label: "Gigi", icon: Sparkles },
  { to: "/themes", label: "Motyw", icon: Palette },
  { to: "/settings", label: "Ustawienia", icon: Settings },
] as const;

const navLinks = [
  { to: "/library", icon: Library, label: "Biblioteka" },
  { to: "/notes", icon: NotebookPen, label: "Notatki" },
  { to: "/quotes", icon: Quote, label: "Cytaty" },
  { to: "/recommendations", icon: Heart, label: "Polecane" },
  { to: "/statistics", icon: BarChart3, label: "Statystyki" },
  { to: "/gigi", icon: Sparkles, label: "Gigi" },
] as const;

const quickActions = [
  { to: "/add-book", icon: BookOpen, label: "Dodaj książkę" },
  { to: "/note/new?type=quote", icon: Quote, label: "Dodaj cytat" },
  { to: "/note/new?type=note", icon: FileText, label: "Dodaj notatkę" },
  { to: "/note/new?type=page-photo", icon: Camera, label: "Zdjęcie strony" },
  { to: "/read", icon: Timer, label: "Sesja czytania" },
  { to: "/notebook", icon: ImageIcon, label: "Notes iPad" },
] as const;

export function AppShell({ children }: { children: ReactNode }) {
  const [drawer, setDrawer] = useState(false);
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { mode, toggle } = useTheme();

  return (
    <div className="min-h-screen flex w-full relative overflow-x-clip">
      <div className="ambient-bg" aria-hidden />
      <div className="ambient-orbs" aria-hidden />

      <aside className="hidden lg:flex flex-col w-60 shrink-0 sticky top-0 h-screen p-4 z-20">
        <div className="glass rounded-[30px] flex-1 flex flex-col p-3">
          <Link to="/" className="px-3 py-4 flex flex-col items-center">
            <div className="font-script text-[2rem] gold-text leading-none">Agata</div>
            <div className="text-[10px] text-warm-muted tracking-[0.24em] uppercase mt-1">Prywatna biblioteka</div>
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

      <main className="flex-1 min-w-0 relative z-10">
        <header className="lg:sticky lg:top-0 z-30 px-4 lg:px-8 pt-4 pb-3">
          <div className="agata-topbar agata-sheen px-3 sm:px-5 py-3 sm:py-3.5 flex items-center">
            <button
              onClick={() => setDrawer(true)}
              className="w-10 h-10 grid place-items-center rounded-full hover:bg-[var(--glass-inner)] text-warm shrink-0"
              aria-label="Profil i menu"
            >
              <UserRound className="w-[18px] h-[18px] gold-text" strokeWidth={1.8} />
            </button>

            <Link to="/" className="absolute left-1/2 -translate-x-1/2 flex items-center justify-center gap-2 sm:gap-3">
              <span className="font-script text-[2.4rem] sm:text-[2.9rem] gold-text leading-none">Agata</span>
              <svg width="36" height="22" viewBox="0 0 38 22" className="opacity-85 gold-text shrink-0" aria-hidden>
                <path d="M3 16c5-6 9-9 14-8 4 .6 7 4.4 9 9" stroke="currentColor" strokeWidth="1.2" fill="none" strokeLinecap="round" />
                <path d="M22 8c2-2 4-4 7-4" stroke="currentColor" strokeWidth="1.1" fill="none" strokeLinecap="round" />
                <path d="M24 10c2-1 4-2 7-1" stroke="currentColor" strokeWidth="1.1" fill="none" strokeLinecap="round" />
                <path d="M25 13c2 0 4 .5 6 2" stroke="currentColor" strokeWidth="1.1" fill="none" strokeLinecap="round" />
                <circle cx="20" cy="10" r="1.3" fill="currentColor" />
                <circle cx="28" cy="4.8" r="1" fill="currentColor" />
                <circle cx="32" cy="9.2" r=".95" fill="currentColor" />
                <circle cx="33.5" cy="15.5" r=".85" fill="currentColor" />
              </svg>
            </Link>

            <div className="ml-auto flex items-center gap-2 shrink-0">
              <button
                onClick={toggle}
                aria-label={mode === "dark" ? "Tryb jasny" : "Tryb ciemny"}
                className="hidden md:grid w-10 h-10 place-items-center rounded-full hover:bg-[var(--glass-inner)] text-warm"
              >
                {mode === "dark" ? <Sun className="w-[18px] h-[18px] gold-text" /> : <Moon className="w-[18px] h-[18px] gold-text" />}
              </button>
              <button
                className="w-10 h-10 grid place-items-center rounded-full hover:bg-[var(--glass-inner)] text-warm"
                aria-label="Powiadomienia"
              >
                <Bell className="w-[18px] h-[18px] gold-text" strokeWidth={1.8} />
              </button>
            </div>
          </div>
        </header>

        {children}
      </main>

      {drawer && (
        <div
          className="lg:hidden fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex"
          onClick={() => setDrawer(false)}
        >
          <div
            className="agata-drawer agata-sheen w-[300px] h-full p-5 overflow-y-auto rounded-r-[28px]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-5">
              <span className="font-script text-[2rem] gold-text leading-none">Agata</span>
              <button
                onClick={() => setDrawer(false)}
                className="w-9 h-9 grid place-items-center rounded-full hover:bg-[var(--glass-inner)] text-warm"
                aria-label="Zamknij"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <DrawerSection title="Nawigacja">
              {navLinks.map((l) => (
                <DrawerLink key={l.to} {...l} onClick={() => setDrawer(false)} />
              ))}
            </DrawerSection>

            <DrawerSection title="Szybkie akcje">
              {quickActions.map((l) => (
                <DrawerLink key={l.to} {...l} onClick={() => setDrawer(false)} />
              ))}
            </DrawerSection>

            <DrawerSection title="Ustawienia">
              <button
                onClick={toggle}
                className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-sm text-warm hover:bg-[var(--glass-inner)]"
              >
                <span className="flex items-center gap-3">
                  {mode === "dark" ? <Sun className="w-4 h-4 gold-text" /> : <Moon className="w-4 h-4 gold-text" />}
                  Motyw
                </span>
                <span className="text-[11px] text-warm-muted uppercase tracking-wider">
                  {mode === "dark" ? "Ciemny" : "Jasny"}
                </span>
              </button>
              <DrawerLink to="/settings" icon={Settings} label="Ustawienia" onClick={() => setDrawer(false)} />
            </DrawerSection>
          </div>
        </div>
      )}
    </div>
  );
}

function DrawerSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="mb-5">
      <div className="font-serif text-[0.95rem] text-warm-muted px-3 mb-1.5 tracking-wide">
        {title}
      </div>
      <div className="space-y-0.5">{children}</div>
    </div>
  );
}

function DrawerLink({
  to,
  icon: Icon,
  label,
  onClick,
}: {
  to: string;
  icon: typeof Library;
  label: string;
  onClick: () => void;
}) {
  return (
    <Link
      to={to}
      onClick={onClick}
      className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-warm hover:bg-[var(--glass-inner)]"
    >
      <Icon className="w-4 h-4 gold-text" />
      {label}
    </Link>
  );
}
