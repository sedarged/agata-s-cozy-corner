// Agata — pure helpers for the add-book flow on /add-book.
//
// Single source of truth for the duplicate-guard decision and the
// "Dodaj mimo to" override. Lives outside the React component so it can
// be exercised under node:test without booting TanStack Start's
// async-local-storage. `src/routes/add-book.tsx` imports these helpers
// from `useIsDuplicateBook` and from each click handler — there is no
// parallel implementation in the component to drift.

export interface BookLike {
  id: string;
  // `title` is required at the schema level (books.title NOT NULL in
  // drizzle/0000_init.sql) — every book the index ever sees has one.
  title: string;
  author?: string;
  isbn?: string;
}

export interface DupQuery {
  isbn?: string;
  title?: string;
  author?: string;
}

export type DupIndex = {
  isbn: Map<string, BookLike>;
  titleAuthor: Map<string, BookLike>;
};

/**
 * Normalise a string for fuzzy comparison: lowercase, drop combining
 * diacritics (NFKD + Unicode `M` = combining mark), then apply a small
 * Polish-specific transliteration for precomposed letters whose NFKD
 * decomposition is empty (ł, ą, ć, ę, ń, ó, ś, ź, ż — `ł` is the only
 * one without a Latin-base decomposition, so it's the only one NFKD
 * can't catch). Finally collapse non-word runs to single spaces and
 * trim. This module is the single source of truth for normalisation;
 * `src/routes/add-book.tsx` imports these helpers and does not duplicate
 * the rules.
 */
export function normDup(s: string | undefined): string {
  return (s ?? "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/\p{M}+/gu, "")
    .replace(/[łŁąĄćĆęĘńŃóÓśŚźŹżŻ]/g, (ch) => {
      // Polish letters that NFKD can't decompose to a Latin base.
      switch (ch) {
        case "ł":
        case "Ł":
          return "l";
        case "ą":
        case "Ą":
          return "a";
        case "ć":
        case "Ć":
          return "c";
        case "ę":
        case "Ę":
          return "e";
        case "ń":
        case "Ń":
          return "n";
        case "ó":
        case "Ó":
          return "o";
        case "ś":
        case "Ś":
          return "s";
        case "ź":
        case "Ź":
          return "z";
        case "ż":
        case "Ż":
          return "z";
        default:
          return ch;
      }
    })
    .replace(/[^\w]+/g, " ")
    .trim();
}

/**
 * Clean an isbn for index lookup: keep only digits and X/x. Empty string
 * for missing input so the caller can skip the isbn branch.
 */
export function cleanIsbn(isbn: string | undefined): string {
  return (isbn ?? "").replace(/[^0-9Xx]/g, "");
}

/** Build the isbn → book index. Books with no isbn are skipped. */
export function buildIsbnIndex(books: readonly BookLike[]): Map<string, BookLike> {
  const m = new Map<string, BookLike>();
  for (const b of books) {
    const k = cleanIsbn(b.isbn);
    if (k) m.set(k, b);
  }
  return m;
}

/**
 * Build the `norm(title) :: norm(author)` → book index. Books with no
 * normalised title are skipped — author alone is too noisy (e.g. multiple
 * "Adam Mickiewicz" books would all collide if title were optional).
 */
export function buildTitleAuthorIndex(books: readonly BookLike[]): Map<string, BookLike> {
  const m = new Map<string, BookLike>();
  for (const b of books) {
    const t = normDup(b.title);
    const a = normDup(b.author);
    if (t) m.set(`${t}::${a}`, b);
  }
  return m;
}

/**
 * Look up the duplicate of `query` in `index`. Isbn wins when present;
 * otherwise we fall back to the title+author key. Returns `undefined`
 * when no match is found (or when the query is too sparse to look up).
 */
export function findDuplicate(index: DupIndex, query: DupQuery): BookLike | undefined {
  const isbnClean = cleanIsbn(query.isbn);
  if (isbnClean) {
    const hit = index.isbn.get(isbnClean);
    if (hit) return hit;
  }
  const t = normDup(query.title);
  if (!t) return undefined;
  const a = normDup(query.author);
  return index.titleAuthor.get(`${t}::${a}`);
}

/**
 * What the caller should do when the user clicks "Dodaj do biblioteki"
 * (force=false) or "Dodaj mimo to" (force=true).
 *
 * - `duplicate` → show the duplicate UI; do NOT call upsertBook.
 * - `proceed` → call upsertBook with `input`.
 *
 * `force=true` always proceeds (this is the "Dodaj mimo to" path that
 * creates a second book in the library sharing the seed's isbn/title).
 */
export type AddDecision =
  | { kind: "duplicate"; book: BookLike }
  | { kind: "proceed"; input: BookLike };

export function decideAddAction(args: {
  force: boolean;
  data: DupQuery;
  index: DupIndex;
  input: BookLike;
}): AddDecision {
  if (!args.force) {
    const existing = findDuplicate(args.index, args.data);
    if (existing) return { kind: "duplicate", book: existing };
  }
  return { kind: "proceed", input: args.input };
}
