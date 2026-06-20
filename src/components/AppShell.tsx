import { Link, useRouterState } from "@tanstack/react-router";
import {
  Home,
  Library,
  NotebookPen,
  Sparkles,
  Quote,
  ListTree,
  BarChart3,
  Heart,
  Palette,
  Settings,
  Bell,
  UserRound,
  X,
  BookOpen,
  Camera,
  FileText,
  Image as ImageIcon,
  Timer,
  Sun,
  Moon,
  LogOut,
  LogIn,
} from "lucide-react";
import { BottomNav } from "@/components/BottomNav";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ThemeToggle } from "@/components/ThemeToggle";
import { useTheme } from "@/lib/theme-context";
import { useAuth } from "@/lib/auth-context";
import { SHOW_AUTH_UI } from "@/lib/feature-flags";

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

type DrawerLinkItem = {
  to: string;
  icon: typeof Library;
  label: string;
  params?: Record<string, string>;
  search?: Record<string, string>;
};

const quickActions: DrawerLinkItem[] = [
  { to: "/add-book", icon: BookOpen, label: "Dodaj książkę" },
  {
    to: "/note/$id",
    params: { id: "new" },
    search: { type: "quote" },
    icon: Quote,
    label: "Dodaj cytat",
  },
  {
    to: "/note/$id",
    params: { id: "new" },
    search: { type: "note" },
    icon: FileText,
    label: "Dodaj notatkę",
  },
  {
    to: "/note/$id",
    params: { id: "new" },
    search: { type: "page-photo" },
    icon: Camera,
    label: "Zdjęcie strony",
  },
  { to: "/read", icon: Timer, label: "Sesja czytania" },
  { to: "/notebook", icon: ImageIcon, label: "Notes iPad" },
];

export function AppShell({ children }: { children: ReactNode }) {
  const [drawer, setDrawer] = useState(false);
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { mode, toggle } = useTheme();
  const { user, signOut } = useAuth();
  const headerRef = useRef<HTMLElement>(null);

  // Close mobile drawer on route change.
  useEffect(() => {
    setDrawer(false);
  }, [pathname]);

  // Expose the sticky header height as a CSS var so descendants can offset their own
  // sticky elements (e.g. NotesListPage preview panel) without hardcoded values.
  useEffect(() => {
    const el = headerRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const apply = () => {
      document.documentElement.style.setProperty("--header-h", `${el.offsetHeight}px`);
    };
    apply();
    const ro = new ResizeObserver(apply);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return (
    <div className="min-h-dvh flex w-full relative overflow-x-clip">
      <div className="ambient-bg" aria-hidden />
      <div className="ambient-orbs" aria-hidden />

      <aside className="hidden lg:flex flex-col w-60 shrink-0 sticky top-0 h-dvh p-4 z-20">
        <div className="glass rounded-[30px] flex-1 flex flex-col p-3">
          <Link to="/" className="px-3 py-4 flex flex-col items-center">
            <div className="font-script text-[2rem] gold-text leading-none">Agata</div>
            <div className="text-[10px] text-warm-muted tracking-[0.24em] uppercase mt-1">
              Prywatna biblioteka
            </div>
          </Link>
          <nav
            className="flex-1 overflow-y-auto px-1 pb-3 space-y-0.5"
            aria-label="Główna nawigacja"
          >
            {sidebarItems.map((item) => {
              const active =
                pathname === item.to || (item.to !== "/" && pathname.startsWith(item.to));
              const Icon = item.icon;
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-colors",
                    active
                      ? "bg-[var(--accent-gold)] text-[var(--bg)]"
                      : "text-warm hover:bg-[var(--glass-inner)]",
                  )}
                >
                  <Icon className="w-4 h-4" aria-hidden="true" />
                  {item.label}
                </Link>
              );
            })}
          </nav>
          <div className="p-3 border-t border-[var(--glass-border)] flex items-center justify-between gap-2">
            {SHOW_AUTH_UI ? (
              user ? (
                <div className="flex items-center gap-2 min-w-0">
                  <div className="w-7 h-7 rounded-full bg-primary text-primary-foreground grid place-items-center text-[10px] font-bold shrink-0">
                    {user.email?.[0]?.toUpperCase() || "U"}
                  </div>
                  <span className="text-[11px] text-warm-muted truncate">{user.email}</span>
                </div>
              ) : (
                <Link
                  to="/auth"
                  className="text-[11px] text-warm-muted hover:text-warm transition-colors"
                >
                  Zaloguj się
                </Link>
              )
            ) : (
              <span className="text-[11px] text-warm-muted">Tryb lokalny</span>
            )}
            <div className="flex items-center gap-1">
              {SHOW_AUTH_UI && user && (
                <button
                  onClick={() => signOut()}
                  className="w-7 h-7 grid place-items-center rounded-full hover:bg-[var(--glass-inner)] text-warm-muted hover:text-warm transition-colors"
                  aria-label="Wyloguj"
                  title="Wyloguj"
                >
                  <LogOut className="w-3.5 h-3.5" />
                </button>
              )}
              <ThemeToggle />
            </div>
          </div>
        </div>
      </aside>

      <main className="flex-1 min-w-0 relative z-10">
        <header ref={headerRef} className="sticky top-0 z-30 px-4 lg:px-8 pt-3 lg:pt-4 pb-3">
          <div className="mx-auto w-full max-w-[var(--content-max)]">
            <div className="agata-topbar agata-sheen px-3 sm:px-5 py-3 sm:py-3.5 flex items-center">
              <button
                onClick={() => setDrawer(true)}
                className="w-10 h-10 grid place-items-center rounded-full hover:bg-[var(--glass-inner)] text-warm shrink-0 lg:hidden"
                aria-label="Otwórz menu nawigacji"
              >
                <UserRound className="w-[18px] h-[18px] gold-text" strokeWidth={1.8} />
              </button>

              <Link
                to="/"
                className="absolute left-1/2 -translate-x-1/2 flex items-center justify-center gap-2 sm:gap-3"
                aria-label="Strona główna"
              >
                <span className="font-script text-[2rem] sm:text-[2.6rem] lg:text-[2.9rem] gold-text leading-none">
                  Agata
                </span>
                <svg
                  width="32"
                  height="20"
                  viewBox="0 0 38 22"
                  className="opacity-85 gold-text shrink-0 hidden sm:block"
                  aria-hidden
                >
                  <path
                    d="M3 16c5-6 9-9 14-8 4 .6 7 4.4 9 9"
                    stroke="currentColor"
                    strokeWidth="1.2"
                    fill="none"
                    strokeLinecap="round"
                  />
                  <path
                    d="M22 8c2-2 4-4 7-4"
                    stroke="currentColor"
                    strokeWidth="1.1"
                    fill="none"
                    strokeLinecap="round"
                  />
                  <path
                    d="M24 10c2-1 4-2 7-1"
                    stroke="currentColor"
                    strokeWidth="1.1"
                    fill="none"
                    strokeLinecap="round"
                  />
                  <path
                    d="M25 13c2 0 4 .5 6 2"
                    stroke="currentColor"
                    strokeWidth="1.1"
                    fill="none"
                    strokeLinecap="round"
                  />
                  <circle cx="20" cy="10" r="1.3" fill="currentColor" />
                  <circle cx="28" cy="4.8" r="1" fill="currentColor" />
                  <circle cx="32" cy="9.2" r=".95" fill="currentColor" />
                  <circle cx="33.5" cy="15.5" r=".85" fill="currentColor" />
                </svg>
              </Link>

              <div className="ml-auto flex items-center gap-1 sm:gap-2 shrink-0">
                <Popover>
                  <PopoverTrigger asChild>
                    <button
                      aria-label="Powiadomienia"
                      className="w-10 h-10 grid place-items-center rounded-full hover:bg-[var(--glass-inner)] text-warm"
                    >
                      <Bell className="w-[18px] h-[18px] gold-text" strokeWidth={1.8} />
                    </button>
                  </PopoverTrigger>
                  <PopoverContent
                    align="end"
                    className="agata-topbar agata-sheen border-[var(--glass-border)] w-72 max-w-[calc(100vw-2rem)] p-5"
                  >
                    <div className="flex flex-col items-center text-center gap-2 py-2">
                      <div className="w-11 h-11 grid place-items-center rounded-full bg-[var(--glass-inner)]">
                        <Bell className="w-5 h-5 gold-text" strokeWidth={1.6} />
                      </div>
                      <p className="font-serif text-sm text-warm">Brak nowych powiadomień</p>
                      <p className="text-[12px] text-warm-muted leading-relaxed">
                        Tu pojawią się przypomnienia o czytaniu i nowości od Gigi.
                      </p>
                    </div>
                  </PopoverContent>
                </Popover>
                <button
                  onClick={toggle}
                  aria-label={mode === "dark" ? "Tryb jasny" : "Tryb ciemny"}
                  className="w-10 h-10 grid place-items-center rounded-full hover:bg-[var(--glass-inner)] text-warm"
                >
                  {mode === "dark" ? (
                    <Sun className="w-[18px] h-[18px] gold-text" />
                  ) : (
                    <Moon className="w-[18px] h-[18px] gold-text" />
                  )}
                </button>
              </div>
            </div>
          </div>
        </header>

        <div className="mx-auto w-full max-w-[var(--content-max)] pb-16 lg:pb-0">{children}</div>
      </main>

      <BottomNav />

      {drawer && (
        <div
          className="lg:hidden fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex"
          onClick={() => setDrawer(false)}
        >
          <div
            className="agata-drawer agata-sheen w-[min(86vw,320px)] h-full p-5 overflow-y-auto rounded-r-[28px]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-5">
              <span className="font-script text-[2rem] gold-text leading-none">Agata</span>
              <button
                onClick={() => setDrawer(false)}
                className="w-10 h-10 grid place-items-center rounded-full hover:bg-[var(--glass-inner)] text-warm"
                aria-label="Zamknij"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <DrawerSection title="Nawigacja">
              {navLinks.map((l) => (
                <DrawerLink
                  key={l.to}
                  {...l}
                  pathname={pathname}
                  onClick={() => setDrawer(false)}
                />
              ))}
            </DrawerSection>

            <DrawerSection title="Szybkie akcje">
              {quickActions.map((l) => (
                <DrawerLink
                  key={`${l.to}-${l.label}`}
                  {...l}
                  pathname={pathname}
                  onClick={() => setDrawer(false)}
                />
              ))}
            </DrawerSection>

            {SHOW_AUTH_UI && (
              <DrawerSection title="Konto">
                {user ? (
                  <div className="px-3 py-2">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-8 h-8 rounded-full bg-primary text-primary-foreground grid place-items-center text-xs font-bold">
                        {user.email?.[0]?.toUpperCase() || "U"}
                      </div>
                      <span className="text-xs text-warm truncate max-w-[180px]">{user.email}</span>
                    </div>
                    <button
                      onClick={() => {
                        signOut();
                        setDrawer(false);
                      }}
                      className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-warm hover:bg-[var(--glass-inner)] w-full text-left"
                    >
                      <LogOut className="w-4 h-4 gold-text" />
                      Wyloguj
                    </button>
                  </div>
                ) : (
                  <DrawerLink
                    to="/auth"
                    icon={LogIn}
                    label="Zaloguj się"
                    pathname={pathname}
                    onClick={() => setDrawer(false)}
                  />
                )}
              </DrawerSection>
            )}

            <DrawerSection title="Ustawienia">
              <button
                onClick={toggle}
                className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-sm text-warm hover:bg-[var(--glass-inner)]"
              >
                <span className="flex items-center gap-3">
                  {mode === "dark" ? (
                    <Sun className="w-4 h-4 gold-text" />
                  ) : (
                    <Moon className="w-4 h-4 gold-text" />
                  )}
                  Motyw
                </span>
                <span className="text-[11px] text-warm-muted uppercase tracking-wider">
                  {mode === "dark" ? "Ciemny" : "Jasny"}
                </span>
              </button>
              <DrawerLink
                to="/settings"
                icon={Settings}
                label="Ustawienia"
                pathname={pathname}
                onClick={() => setDrawer(false)}
              />
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
  params,
  search,
  pathname,
  onClick,
}: DrawerLinkItem & {
  pathname: string;
  onClick: () => void;
}) {
  const active = pathname === to || (to !== "/" && !to.includes("$") && pathname.startsWith(to));
  return (
    <Link
      to={to as never}
      params={params as never}
      search={search as never}
      onClick={onClick}
      aria-current={active ? "page" : undefined}
      className={cn(
        "flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm hover:bg-[var(--glass-inner)]",
        active ? "bg-[var(--accent-gold)] text-[var(--bg)]" : "text-warm",
      )}
    >
      <Icon className="w-4 h-4 gold-text" aria-hidden="true" />
      {label}
    </Link>
  );
}
