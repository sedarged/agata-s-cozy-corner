import { Link, useRouterState } from "@tanstack/react-router";
import { Library, NotebookPen, Timer, BarChart3, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

const items = [
  { to: "/library", icon: Library, label: "Biblioteka" },
  { to: "/notes", icon: NotebookPen, label: "Notatki" },
  { to: "/read", icon: Timer, label: "Czytaj" },
  { to: "/statistics", icon: BarChart3, label: "Statystyki" },
  { to: "/gigi", icon: Sparkles, label: "Gigi" },
] as const;

export function BottomNav() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  return (
    <nav
      className="lg:hidden fixed bottom-0 left-0 right-0 z-40 agata-topbar agata-sheen border-t border-[var(--glass-border)] pb-[env(safe-area-inset-bottom)]"
      aria-label="Nawigacja dolna"
    >
      <div className="flex items-center">
        {items.map(({ to, icon: Icon, label }) => {
          const active = pathname === to || pathname.startsWith(to);
          return (
            <Link
              key={to}
              to={to}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex-1 flex flex-col items-center gap-0.5 py-2.5 transition-colors",
                active ? "text-[var(--accent-gold)]" : "text-warm-muted hover:text-warm",
              )}
            >
              <Icon
                className="w-5 h-5"
                strokeWidth={active ? 2.2 : 1.8}
                aria-hidden="true"
              />
              <span className="text-[10px] tracking-wide">{label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
