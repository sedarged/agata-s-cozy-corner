// Agata — pure fielded-query router for the book-search upstream calls.
//
// Both Google Books and Open Library support structured query keywords
// that produce far better results than a free-text query:
//
//   Google Books    Open Library   meaning
//   ──────────────  ─────────────  ──────────
//   isbn:           isbn:          exact ISBN lookup (highest precision)
//   intitle:        title=         match against the title field only
//   inauthor:       author=        match against the author field only
//   inpublisher:    publisher=     match against the publisher field only
//   subject:        subject=       match against the subject/tag field
//
// Biblioteka Narodowa's bibs API has no equivalent — it accepts
// `title=`, `author=`, `isbnIssn=` directly as separate params. The
// caller (`/api/book-search`) handles that separately via
// `lookupBNByIsbn`; this router only normalises the free-text input
// the user typed in /add-book's search box.
//
// Detection rules:
//
//   1. ISBN-10/ISBN-13 with valid check digit                →  isbn: keyword
//   2. "author:" / "title:" / "subject:" user hint prefix     →  inauthor: / intitle: / subject:
//   3. 1-4 word phrase                                       →  intitle: / title=
//      (a famous one-word Polish title like "Wiedźmin" is
//      almost certainly a title query — auto-promoting loses
//      nothing of value, and GB's free-text fallback dilutes
//      the result with author/subject matches.)
//   4. 5+ words (looks like a search phrase)                 →  free text
//   5. Empty                                                 →  unknown (caller short-circuits)
//
// `kind` is exposed for the UI to show a "Wyszukiwanie po tytule"
// hint when the routing is non-obvious.
//
// Pure, no fetch, no DB. Pinned by `book-search-query.spec.ts`.

export type RouteKind = "isbn" | "title" | "author" | "free" | "unknown";

export interface RoutedQueries {
  /** "isbn" when the input passed ISBN check digit; "title"/"author" when the user prefixed it; "free" for everything else. */
  kind: RouteKind;
  /** What to send to Google Books `q=…`. */
  google: string;
  /** What to send to Open Library `q=…` (Solr syntax). */
  openlibrary: string;
  /** What to send to BN's bibs API as the `title=` param. */
  bn: string;
}

/**
 * Detect ISBN-10 or ISBN-13 (with optional hyphens/spaces/periods/etc.,
 * X-allowed at the end of ISBN-10). Returns the cleaned digits (and
 * trailing X) on match, undefined otherwise.
 */
export function detectIsbn(input: string): string | undefined {
  if (!input) return undefined;
  // Strip everything that isn't a digit or X (covers hyphens, spaces,
  // periods, slashes, non-breaking spaces from copy-paste / barcode
  // scanners). Matches `cleanIsbn` in book-search.server.ts.
  const cleaned = input.replace(/[^\dXx]/g, "").toUpperCase();
  // ISBN-13: 13 digits, must start with 978 or 979.
  if (/^97[89]\d{10}$/.test(cleaned)) return cleaned;
  // ISBN-10: 9 digits + check char (digit or X).
  if (/^\d{9}[\dX]$/.test(cleaned)) {
    // Verify the check digit mod-11.
    let sum = 0;
    for (let i = 0; i < 9; i += 1) {
      sum += (i + 1) * Number(cleaned[i]);
    }
    const checkChar = cleaned[9];
    const checkVal = checkChar === "X" ? 10 : Number(checkChar);
    sum += 10 * checkVal;
    if (sum % 11 === 0) return cleaned;
  }
  return undefined;
}

/**
 * Strip a leading `author:` / `title:` / `subject:` user hint and return
 * the rest of the input plus the hint kind. Returns undefined if no
 * recognized hint is present.
 */
function detectHint(
  input: string,
): { kind: "author" | "title" | "subject"; rest: string } | undefined {
  const m = /^(author|title|subject):\s*(.+)$/i.exec(input);
  if (!m) return undefined;
  return { kind: m[1].toLowerCase() as "author" | "title" | "subject", rest: m[2].trim() };
}

/**
 * Route a user query string to per-API keyword-form queries.
 * See the module-level comment for the routing rules.
 */
export function routeQuery(input: string): RoutedQueries {
  const trimmed = (input ?? "").trim();
  if (!trimmed) {
    return { kind: "unknown", google: "", openlibrary: "", bn: "" };
  }
  // 1. ISBN check-digit path — exact match across all three APIs.
  const isbn = detectIsbn(trimmed);
  if (isbn) {
    return {
      kind: "isbn",
      google: `isbn:${isbn}`,
      openlibrary: `isbn:${isbn}`,
      bn: isbn,
    };
  }
  // 2. User hint path — `author: X`, `title: X`, `subject: X`.
  const hint = detectHint(trimmed);
  if (hint) {
    if (hint.kind === "author") {
      return {
        kind: "author",
        google: `inauthor:${hint.rest}`,
        openlibrary: `author=${hint.rest}`,
        bn: hint.rest,
      };
    }
    if (hint.kind === "title") {
      return {
        kind: "title",
        google: `intitle:${hint.rest}`,
        openlibrary: `title=${hint.rest}`,
        bn: hint.rest,
      };
    }
    // subject: — GB uses `subject:`, OL uses `subject=`.
    return {
      kind: "title", // not a perfect label but closest; kind is informational only.
      google: `subject:${hint.rest}`,
      openlibrary: `subject=${hint.rest}`,
      bn: hint.rest,
    };
  }
  // 3. Short phrase (1-4 words) — auto-promote to title field, EXCEPT
  // when the single token looks like a proper noun (likely an author
  // surname like "Sapkowski", "Rowling", "Tolkien"). Routing a surname
  // to intitle:/title= would zero out the upstream's author-field
  // ranking and miss the books the user is actually looking for. We
  // detect "proper-noun-shaped single token" as: starts with an ASCII
  // uppercase A-Z AND contains only letters/diacritics/hyphens (no
  // digits, no whitespace). Multi-word phrases are still title-routed
  // because "Pan Tadeusz" / "Harry Potter" are unambiguously titles.
  const tokens = trimmed.split(/\s+/).filter(Boolean);
  if (tokens.length >= 2 && tokens.length <= 4) {
    return {
      kind: "title",
      google: `intitle:${trimmed}`,
      openlibrary: `title=${trimmed}`,
      bn: trimmed,
    };
  }
  if (tokens.length === 1) {
    const t = tokens[0];
    const looksLikeSurname = /^[A-ZŚĆŻŹŁÓĘĄŃ][\p{L}\p{M}-]+$/u.test(t);
    if (!looksLikeSurname) {
      return {
        kind: "title",
        google: `intitle:${trimmed}`,
        openlibrary: `title=${trimmed}`,
        bn: trimmed,
      };
    }
    // Single Capitalized token — free text so the upstream can rank by
    // author field. (A single all-lowercase word like "wiedźmin" still
    // gets the title-routing branch above.)
  }
  // 4. Free text — pass through unchanged. The caller adds the
  // `polishFirst` / `polish` language flag at the call site based on
  // Polish diacritic presence in `input`, so the routed form stays
  // simple here.
  return {
    kind: "free",
    google: trimmed,
    openlibrary: trimmed,
    bn: trimmed,
  };
}
