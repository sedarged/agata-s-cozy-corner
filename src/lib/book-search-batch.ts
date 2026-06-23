// book-search-batch.ts — pure helpers for the /api/book-search/batch
// endpoint. Splits the input into valid ISBNs to look up and invalid
// entries the caller should report. Caps the batch size so a single
// request can't fan out to dozens of upstream lookups.

export const BATCH_MAX = 20;

export type BatchInput = (string | null | undefined)[];

export interface BatchSplit {
  /** Cleaned ISBNs, de-duplicated, length 1..BATCH_MAX. */
  valid: string[];
  /** Original entries (with their trimmed string form) that weren't valid. */
  invalid: { input: string; reason: string }[];
  /** True when the input had more than BATCH_MAX entries — caller must chunk. */
  tooMany: boolean;
}

export function splitIsbns(input: BatchInput): BatchSplit {
  if (input.length > BATCH_MAX) {
    return { valid: [], invalid: [], tooMany: true };
  }
  const seen = new Set<string>();
  const valid: string[] = [];
  const invalid: { input: string; reason: string }[] = [];
  for (const raw of input) {
    const s = (raw ?? "").toString().trim();
    if (!s) {
      invalid.push({ input: String(raw ?? ""), reason: "empty" });
      continue;
    }
    const cleaned = s.replace(/[^0-9Xx]/g, "");
    if (cleaned.length !== 10 && cleaned.length !== 13) {
      invalid.push({ input: s, reason: "must be ISBN-10 or ISBN-13" });
      continue;
    }
    if (cleaned.length === 13 && !/^\d{13}$/.test(cleaned)) {
      invalid.push({ input: s, reason: "bad ISBN-13 format" });
      continue;
    }
    // Dedup on the exact cleaned form. Case-insensitive X would risk
    // colliding 13-digit and 10-digit ISBNs that share trailing digits
    // (e.g. "9780201616224" vs "0201616224X"), so we use the exact value.
    if (seen.has(cleaned)) continue;
    seen.add(cleaned);
    // Canonicalise the X check digit to uppercase for consistency with
    // the server-side ISBN lookup (which expects ISBN-10's `[0-9]{9}[0-9X]`).
    valid.push(cleaned.toUpperCase());
  }
  return { valid, invalid, tooMany: false };
}
