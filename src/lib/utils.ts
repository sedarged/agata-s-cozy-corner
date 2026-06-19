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
