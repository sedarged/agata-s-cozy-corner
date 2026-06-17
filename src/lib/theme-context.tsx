import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

export type ThemeName = "cream" | "coffee" | "burgundy" | "rose" | "minimal" | "dark";

export const themes: { id: ThemeName; label: string; swatch: string[] }[] = [
  { id: "coffee", label: "Coffee", swatch: ["#d4b896", "#8a6a4a", "#3a2a1a"] },
  { id: "burgundy", label: "Burgundy", swatch: ["#f0d8d8", "#a8485a", "#3a1018"] },
  { id: "cream", label: "Cream", swatch: ["#fcf5e9", "#d4b896", "#6a4838"] },
  { id: "dark", label: "Dark Cozy", swatch: ["#3a2a1a", "#1a1008", "#d4a878"] },
  { id: "rose", label: "Rose", swatch: ["#ffe0d8", "#d49090", "#7a3848"] },
  { id: "minimal", label: "Minimal", swatch: ["#ffffff", "#e8e8e8", "#2a2a2a"] },
];

interface Ctx { theme: ThemeName; setTheme: (t: ThemeName) => void; }
const ThemeContext = createContext<Ctx>({ theme: "cream", setTheme: () => {} });

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<ThemeName>("cream");

  useEffect(() => {
    const stored = typeof window !== "undefined" ? localStorage.getItem("agata-theme") as ThemeName | null : null;
    if (stored) setTheme(stored);
  }, []);

  useEffect(() => {
    if (typeof document === "undefined") return;
    const root = document.documentElement;
    ["theme-cream","theme-coffee","theme-burgundy","theme-rose","theme-minimal","theme-dark"].forEach(c => root.classList.remove(c));
    root.classList.add(`theme-${theme}`);
    localStorage.setItem("agata-theme", theme);
  }, [theme]);

  return <ThemeContext.Provider value={{ theme, setTheme }}>{children}</ThemeContext.Provider>;
}

export const useTheme = () => useContext(ThemeContext);
