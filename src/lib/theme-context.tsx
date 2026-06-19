import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

export type ThemeMode = "light" | "dark";

const STORAGE_KEY = "agata-theme-mode";

interface Ctx {
  mode: ThemeMode;
  setMode: (m: ThemeMode) => void;
  toggle: () => void;
}

const ThemeContext = createContext<Ctx>({ mode: "light", setMode: () => {}, toggle: () => {} });

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [mode, setMode] = useState<ThemeMode>("light");

  useEffect(() => {
    if (typeof window === "undefined") return;
    let stored: ThemeMode | null = null;
    try {
      stored = localStorage.getItem(STORAGE_KEY) as ThemeMode | null;
    } catch {
      /* noop */
    }
    if (stored === "light" || stored === "dark") {
      setMode(stored);
      return;
    }
    // Fall back to OS preference on first load.
    if (window.matchMedia?.("(prefers-color-scheme: dark)").matches) {
      setMode("dark");
    }
  }, []);

  useEffect(() => {
    if (typeof document === "undefined") return;
    const root = document.documentElement;
    root.classList.toggle("dark", mode === "dark");
    root.dataset.theme = mode;
    try {
      localStorage.setItem(STORAGE_KEY, mode);
    } catch {
      /* noop */
    }
  }, [mode]);

  return (
    <ThemeContext.Provider
      value={{ mode, setMode, toggle: () => setMode(mode === "light" ? "dark" : "light") }}
    >
      {children}
    </ThemeContext.Provider>
  );
}

export const useTheme = () => useContext(ThemeContext);
