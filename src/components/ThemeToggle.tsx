import { Moon, Sun } from "lucide-react";
import { useTheme } from "@/lib/theme-context";
import { cn } from "@/lib/utils";

export function ThemeToggle({ className }: { className?: string }) {
  const { mode, toggle } = useTheme();
  const isDark = mode === "dark";
  return (
    <button
      onClick={toggle}
      aria-label={isDark ? "Tryb jasny" : "Tryb ciemny"}
      title={isDark ? "Tryb jasny" : "Tryb ciemny"}
      className={cn(
        "glass-pill w-10 h-10 grid place-items-center text-warm hover:scale-[1.03] active:scale-95 transition",
        className,
      )}
    >
      {isDark ? <Sun className="w-4 h-4 gold-text" /> : <Moon className="w-4 h-4 gold-text" />}
    </button>
  );
}
