import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Diacritics-insensitive, case-insensitive fold for client-side search.
 * "Żywiołaczko" → "zywiolaczko". Keeps punctuation (unlike books-store's
 * matching normalize) so it stays cheap and predictable for substring search.
 */
export function foldText(s: string | null | undefined): string {
  return (s || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

/**
 * Local calendar day as `YYYY-MM-DD` (NOT UTC). This is the canonical day-bucket
 * key shared by reading-session storage and the statistics aggregations, so that
 * a session always lands in the same day the user actually read it in their own
 * timezone (toISOString() would shift evenings/early mornings across the date line).
 */
export function localDay(d: Date = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/**
 * Polish plural forms: 1 → one, 2-4 → few, 5+ → many.
 * pluralPL(3, "książka", "książki", "książek") → "książki"
 */
export function pluralPL(n: number, one: string, few: string, many: string): string {
  if (n === 1) return one;
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return few;
  return many;
}

/**
 * Format an ISO date string to a short Polish date. Returns "" for invalid/missing.
 */
export function formatDatePL(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso.slice(0, 10);
  return d.toLocaleDateString("pl-PL", { day: "numeric", month: "short", year: "numeric" });
}

/**
 * Collision-resistant local id with a readable prefix, e.g. `note-<uuid>`.
 * Uses crypto.randomUUID when available, falling back to time+random.
 */
export function genId(prefix: string): string {
  const unique =
    typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  return `${prefix}-${unique}`;
}
