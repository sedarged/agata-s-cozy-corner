// Server-side book search. Runs on the Nitro server (via /api/book-search) so
// requests reach the library APIs reliably — not subject to the browser's
// ad-blockers, CSP, or CORS quirks.
//
// Sources (all public, no key, no paid APIs):
//   - Google Books          — broad catalogue + good covers
//   - Open Library          — broad catalogue + covers by id/isbn
//   - Biblioteka Narodowa   — Polish National Library (best Polish metadata)
// Results are merged/deduped across sources; Polish + complete-metadata rank higher.
import "@tanstack/react-start/server-only";
import { foldText } from "./utils";
import type { BookSearchResult } from "./book-search-types";
import { withCache } from "./book-search-cache";

// 5 min TTL — short enough to feel fresh, long enough to absorb the
// "type a few characters → backspace → retype" pattern in the search box.
const SEARCH_TTL_MS = 5 * 60_000;

interface OLDoc {
  key: string;
  title: string;
  subtitle?: string;
  author_name?: string[];
  isbn?: string[];
  cover_i?: number;
  cover_edition_key?: string;
  first_publish_year?: number;
  number_of_pages_median?: number;
  subject?: string[];
  publisher?: string[];
  language?: string[];
  ratings_average?: number;
  ratings_count?: number;
  edition_count?: number;
  first_sentence?: string[];
  ia?: string[];
  ebook_access?: string;
}

interface GBVolume {
  id: string;
  volumeInfo: {
    title?: string;
    subtitle?: string;
    authors?: string[];
    description?: string;
    pageCount?: number;
    publishedDate?: string;
    industryIdentifiers?: { type: string; identifier: string }[];
    imageLinks?: {
      thumbnail?: string;
      smallThumbnail?: string;
      small?: string;
      medium?: string;
      large?: string;
      extraLarge?: string;
    };
    categories?: string[];
    publisher?: string;
    language?: string;
    averageRating?: number;
    ratingsCount?: number;
    previewLink?: string;
    infoLink?: string;
    canonicalVolumeLink?: string;
    maturityRating?: string;
  };
  saleInfo?: {
    buyLink?: string;
    saleability?: string;
  };
  accessInfo?: {
    webReaderLink?: string;
    viewability?: string;
  };
}

// Biblioteka Narodowa (data.bn.org.pl) "bibs" record — only the fields we use.
interface BNBib {
  id?: number | string;
  title?: string;
  author?: string;
  publisher?: string;
  publicationYear?: string;
  isbnIssn?: string;
  pages?: string;
  language?: string;
  subject?: string;
  genre?: string;
  formatOfResource?: string;
}

function mapOLLang(l?: string): string | undefined {
  if (!l) return undefined;
  const v = l.toLowerCase();
  if (v === "pol" || v === "pl") return "pl";
  if (v === "eng" || v === "en") return "en";
  if (v === "ger" || v === "deu" || v === "de") return "de";
  if (v === "fre" || v === "fra" || v === "fr") return "fr";
  return v.slice(0, 2);
}

function cleanIsbn(s?: string): string {
  return (s || "").replace(/[^0-9Xx]/g, "");
}

// A missing Open Library cover should 404 (→ BookCover's onError fallback)
// rather than return a blank gray placeholder image.
function olCoverById(id: number): string {
  return `https://covers.openlibrary.org/b/id/${id}-L.jpg?default=false`;
}
function olCoverByOlid(olid: string): string {
  return `https://covers.openlibrary.org/b/olid/${olid}-L.jpg?default=false`;
}
function olCoverByIsbn(isbn: string): string {
  return `https://covers.openlibrary.org/b/isbn/${isbn}-L.jpg?default=false`;
}

async function fetchWithTimeout(url: string, timeoutMs = 8000): Promise<Response> {
  const ctrl = new AbortController();
  const id = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    return await fetch(url, { signal: ctrl.signal });
  } finally {
    clearTimeout(id);
  }
}

function upscaleGoogleCover(url?: string): string | undefined {
  if (!url) return undefined;
  let u = url.replace("http://", "https://");
  if (u.includes("zoom=")) u = u.replace(/zoom=\d/, "zoom=2");
  else u = u + (u.includes("?") ? "&" : "?") + "zoom=2";
  u = u.replace(/&edge=curl/, "");
  return u;
}

function bestGoogleCover(info: GBVolume["volumeInfo"]): string | undefined {
  const il = info.imageLinks;
  if (!il) return undefined;
  return (
    il.extraLarge?.replace("http://", "https://") ||
    il.large?.replace("http://", "https://") ||
    il.medium?.replace("http://", "https://") ||
    upscaleGoogleCover(il.thumbnail) ||
    upscaleGoogleCover(il.smallThumbnail)
  );
}

function pickIsbns(ids?: { type: string; identifier: string }[]): {
  isbn?: string;
  isbn10?: string;
  isbn13?: string;
} {
  if (!ids) return {};
  const i13 = ids.find((i) => i.type === "ISBN_13")?.identifier;
  const i10 = ids.find((i) => i.type === "ISBN_10")?.identifier;
  return { isbn: i13 ?? i10, isbn13: i13, isbn10: i10 };
}

function mapGoogleVolume(v: GBVolume): BookSearchResult {
  const info = v.volumeInfo;
  const ids = pickIsbns(info.industryIdentifiers);
  return {
    source: "google",
    external_id: v.id,
    title: info.title ?? "Brak tytułu",
    subtitle: info.subtitle,
    author: info.authors?.[0] ?? "Brak autora",
    authors: info.authors,
    isbn: ids.isbn,
    isbn10: ids.isbn10,
    isbn13: ids.isbn13,
    cover_url: bestGoogleCover(info),
    description: info.description,
    page_count: info.pageCount,
    published_date: info.publishedDate,
    category: info.categories?.[0],
    subjects: info.categories,
    publisher: info.publisher,
    language: info.language?.toLowerCase(),
    rating: info.averageRating,
    ratings_count: info.ratingsCount,
    preview_url: info.previewLink,
    info_url: info.infoLink ?? info.canonicalVolumeLink,
    buy_url: v.saleInfo?.buyLink,
    read_online_url:
      v.accessInfo?.viewability === "ALL_PAGES" ? v.accessInfo?.webReaderLink : undefined,
    maturity_rating: info.maturityRating,
  };
}

const OL_FIELDS =
  "key,title,subtitle,author_name,isbn,cover_i,cover_edition_key,first_publish_year,number_of_pages_median,subject,publisher,language,ratings_average,ratings_count,edition_count,first_sentence,ia,ebook_access";

async function searchOpenLibrary(
  q: string,
  opts?: { polish?: boolean },
): Promise<BookSearchResult[]> {
  const langParam = opts?.polish ? "&language=pol" : "";
  const url = `https://openlibrary.org/search.json?q=${encodeURIComponent(q)}&limit=15&fields=${OL_FIELDS}${langParam}`;
  const res = await fetchWithTimeout(url);
  if (!res.ok) return [];
  const json = (await res.json()) as { docs: OLDoc[] };
  return json.docs.map((d) => {
    const coverUrl = d.cover_i
      ? olCoverById(d.cover_i)
      : d.cover_edition_key
        ? olCoverByOlid(d.cover_edition_key)
        : undefined;
    const readOnline =
      d.ia?.[0] && (d.ebook_access === "public" || d.ebook_access === "borrowable")
        ? `https://archive.org/details/${d.ia[0]}`
        : undefined;
    return {
      source: "openlibrary" as const,
      external_id: d.key,
      title: d.title || "Brak tytułu",
      subtitle: d.subtitle,
      author: d.author_name?.[0] ?? "Brak autora",
      authors: d.author_name,
      isbn: d.isbn?.[0],
      cover_url: coverUrl,
      page_count: d.number_of_pages_median,
      published_date: d.first_publish_year ? String(d.first_publish_year) : undefined,
      category: d.subject?.[0],
      subjects: d.subject?.slice(0, 8),
      publisher: d.publisher?.[0],
      language: mapOLLang(d.language?.[0]),
      rating: d.ratings_average,
      ratings_count: d.ratings_count,
      edition_count: d.edition_count,
      first_sentence: d.first_sentence?.[0],
      read_online_url: readOnline,
      info_url: d.key.startsWith("/") ? `https://openlibrary.org${d.key}` : undefined,
    };
  });
}

async function searchGoogleBooks(
  q: string,
  opts?: { polishFirst?: boolean },
): Promise<BookSearchResult[]> {
  const base = `https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(q)}&maxResults=15&printType=books`;
  const tryUrl = async (url: string): Promise<BookSearchResult[]> => {
    const res = await fetchWithTimeout(url);
    if (!res.ok) return [];
    const json = (await res.json()) as { items?: GBVolume[] };
    return (json.items ?? []).map(mapGoogleVolume);
  };
  if (opts?.polishFirst) {
    const pl = await tryUrl(`${base}&langRestrict=pl`);
    if (pl.length > 0) {
      const more = await tryUrl(base);
      const seen = new Set(pl.map((r) => r.external_id));
      return [...pl, ...more.filter((r) => !seen.has(r.external_id))];
    }
  }
  return tryUrl(base);
}

// ---------- Biblioteka Narodowa (data.bn.org.pl) ----------

// BN titles look like "Wiedźmin / Andrzej Sapkowski." — keep the part before " / ".
function cleanBNTitle(raw?: string): string {
  if (!raw) return "Brak tytułu";
  const beforeSlash = raw.split(" / ")[0] ?? raw;
  return beforeSlash.replace(/\s*[.,:;/]\s*$/, "").trim() || "Brak tytułu";
}

// BN authors look like "Sapkowski, Andrzej (1948- )." — normalise to "Andrzej Sapkowski".
function cleanBNAuthor(raw?: string): string {
  if (!raw) return "Brak autora";
  let a = raw.replace(/\([^)]*\)/g, ""); // drop life dates etc.
  a = a.replace(/\s*[.,;]\s*$/, "").trim();
  const parts = a.split(",").map((p) => p.trim());
  if (parts.length >= 2 && parts[0] && parts[1]) return `${parts[1]} ${parts[0]}`.trim();
  return a || "Brak autora";
}

function parseFirstInt(s?: string): number | undefined {
  const m = (s || "").match(/\d+/);
  return m ? parseInt(m[0], 10) : undefined;
}
function parseYear(s?: string): string | undefined {
  const m = (s || "").match(/\d{4}/);
  return m ? m[0] : undefined;
}

function mapBNBib(b: BNBib): BookSearchResult {
  const isbn = cleanIsbn(b.isbnIssn?.split(/[\s;,]/)[0]);
  const subjects = b.subject
    ? b.subject
        .split(/[;]/)
        .map((s) => s.trim())
        .filter(Boolean)
    : undefined;
  return {
    source: "bn",
    external_id: String(b.id ?? isbn ?? cleanBNTitle(b.title)),
    title: cleanBNTitle(b.title),
    author: cleanBNAuthor(b.author),
    isbn: isbn || undefined,
    isbn13: isbn.length === 13 ? isbn : undefined,
    isbn10: isbn.length === 10 ? isbn : undefined,
    page_count: parseFirstInt(b.pages),
    published_date: parseYear(b.publicationYear),
    publisher: b.publisher?.replace(/\s*[.,:;]\s*$/, "").trim() || undefined,
    language: mapOLLang(b.language) ?? "pl",
    category: subjects?.[0] ?? b.genre,
    subjects,
  };
}

async function fetchBN(params: string): Promise<BookSearchResult[]> {
  const url = `https://data.bn.org.pl/api/institutions/bibs.json?${params}&amount=20`;
  const res = await fetchWithTimeout(url);
  if (!res.ok) return [];
  const json = (await res.json()) as { bibs?: BNBib[] };
  return (json.bibs ?? []).map(mapBNBib).filter((r) => r.title !== "Brak tytułu");
}

async function searchBN(q: string): Promise<BookSearchResult[]> {
  // BN's bibs API searches by structured fields; title covers most lookups.
  return fetchBN(`title=${encodeURIComponent(q)}`);
}

async function lookupBNByIsbn(isbn: string): Promise<BookSearchResult | null> {
  const results = await fetchBN(`isbnIssn=${encodeURIComponent(isbn)}`);
  return results[0] ?? null;
}

// ---------- merge / score ----------

function normalizeKey(r: BookSearchResult): string {
  const isbn = cleanIsbn(r.isbn);
  if (isbn) return `isbn:${isbn}`;
  const t = foldText(r.title).replace(/\s+/g, " ").trim();
  const a = foldText(r.author).replace(/\s+/g, " ").trim();
  return `ta:${t}::${a}`;
}

function mergeResults(a: BookSearchResult, b: BookSearchResult): BookSearchResult {
  return {
    ...a,
    subtitle: a.subtitle ?? b.subtitle,
    cover_url: a.cover_url ?? b.cover_url,
    description: a.description ?? b.description,
    page_count: a.page_count ?? b.page_count,
    published_date: a.published_date ?? b.published_date,
    category: a.category ?? b.category,
    subjects: a.subjects?.length ? a.subjects : b.subjects,
    publisher: a.publisher ?? b.publisher,
    language: a.language ?? b.language,
    isbn: a.isbn ?? b.isbn,
    isbn10: a.isbn10 ?? b.isbn10,
    isbn13: a.isbn13 ?? b.isbn13,
    rating: a.rating ?? b.rating,
    ratings_count: a.ratings_count ?? b.ratings_count,
    edition_count: a.edition_count ?? b.edition_count,
    first_sentence: a.first_sentence ?? b.first_sentence,
    preview_url: a.preview_url ?? b.preview_url,
    info_url: a.info_url ?? b.info_url,
    buy_url: a.buy_url ?? b.buy_url,
    read_online_url: a.read_online_url ?? b.read_online_url,
    authors: a.authors?.length ? a.authors : b.authors,
    maturity_rating: a.maturity_rating ?? b.maturity_rating,
  };
}

function scoreResult(r: BookSearchResult, q: string): number {
  let s = 0;
  if (r.language === "pl") s += 10;
  if (r.publisher && /polsk|wydawnictwo|warszawa|kraków/i.test(r.publisher)) s += 4;
  if (r.cover_url) s += 2;
  if (r.isbn) s += 2;
  if (r.page_count) s += 1;
  if (r.description) s += 1;
  if (r.publisher) s += 1;
  if (r.published_date) s += 1;
  if (r.rating) s += 1;
  if ((r.ratings_count ?? 0) > 50) s += 1;
  const qn = foldText(q);
  if (qn && foldText(r.title).includes(qn)) s += 2;
  if (qn && foldText(r.author).includes(qn)) s += 1;
  if (r.source === "google") s += 0.5;
  return s;
}

// Last-resort cover: when a merged result has an ISBN, fan out to TWO
// independent ISBN-keyed cover sources before giving up:
//
//   1. Google Books (`/books/v1/volumes?q=isbn:<ISBN>`) — the second API
//      source. GB returns a cover in `imageLinks.thumbnail` even when the
//      Open Library record lacks a `cover_i` or `cover_edition_key`.
//      `mapGoogleVolume` already runs `bestGoogleCover` so the URL it
//      produces is the largest variant with `zoom=2`.
//   2. Open Library (`covers.openlibrary.org/b/isbn/<ISBN>-L.jpg`) — the
//      URL is constructed directly; a missing cover 404s gracefully and
//      BookCover's `onError` shows the gradient placeholder.
//
// Upgrade path: if the merged result already has an OL cover (the typical
// case for `/search` results backed by `searchOpenLibrary`), still query
// GB-by-ISBN so GB can win when it carries a sharper `zoom=2` variant.
// Skip the upgrade when the existing cover is already from GB (no point
// re-querying the same source for the same image).
//
// `enrichCover` is async so it can call out to GB.
async function enrichCover(r: BookSearchResult): Promise<BookSearchResult> {
  const isbn = cleanIsbn(r.isbn);
  if (!isbn) return r;
  const hasGBCover = !!r.cover_url && r.cover_url.includes("books.google.com");
  if (hasGBCover) return r;
  let gbCover: string | undefined;
  try {
    const gb = await searchGoogleBooks(`isbn:${isbn}`);
    gbCover = gb[0]?.cover_url;
  } catch {
    // GB unreachable — keep the existing cover if any, otherwise fall
    // through to the OL ISBN URL below.
  }
  if (gbCover) return { ...r, cover_url: gbCover };
  if (r.cover_url) return r; // already have an OL cover; don't downgrade.
  return { ...r, cover_url: olCoverByIsbn(isbn) };
}

function dedupeMerge(lists: BookSearchResult[][]): BookSearchResult[] {
  const byKey = new Map<string, BookSearchResult>();
  for (const r of lists.flat()) {
    const k = normalizeKey(r);
    const existing = byKey.get(k);
    byKey.set(k, existing ? mergeResults(existing, r) : r);
  }
  return Array.from(byKey.values());
}

function settledValue<T>(r: PromiseSettledResult<T[]>): T[] {
  return r.status === "fulfilled" ? r.value : [];
}

// ---------- public server API ----------

export async function searchBooksServer(q: string): Promise<BookSearchResult[]> {
  if (!q.trim()) return [];
  // Cache key normalises case + trims + drops diacritics-folded form
  // so "Wiedźmin", "WIEDŹMIN", and "wiedzmin" share one upstream call.
  const key = `search:${foldText(q).replace(/\s+/g, " ").trim()}`;
  return withCache(key, SEARCH_TTL_MS, async () => {
    const [gb, ol, bn] = await Promise.allSettled([
      searchGoogleBooks(q, { polishFirst: true }),
      searchOpenLibrary(q, { polish: /[ąćęłńóśźż]/i.test(q) }),
      searchBN(q),
    ]);
    const merged = dedupeMerge([settledValue(gb), settledValue(ol), settledValue(bn)]);
    // `enrichCover` owns the full chain: existing GB cover wins, then a
    // GB-by-ISBN upgrade pass for any OL cover, then the OL ISBN URL
    // fallback. The GB-by-ISBN pass is safe to skip only when the
    // existing cover is already from GB (re-querying the same source is
    // wasted work).
    const withCovers = await Promise.all(merged.map(enrichCover));
    withCovers.sort((a, b) => scoreResult(b, q) - scoreResult(a, q));
    return withCovers;
  });
}

// Pull a single ISBN detail from Open Library. Cached separately per ISBN
// so a second lookup within the TTL is free.
async function fetchOLIsbn(clean: string): Promise<BookSearchResult | null> {
  try {
    const res = await fetchWithTimeout(`https://openlibrary.org/isbn/${clean}.json`);
    if (!res.ok) return null;
    const d: {
      title: string;
      subtitle?: string;
      authors?: { key: string }[];
      number_of_pages?: number;
      publish_date?: string;
      covers?: number[];
      subjects?: string[];
      description?: string | { value: string };
      publishers?: string[];
      languages?: { key: string }[];
      works?: { key: string }[];
    } = await res.json();
    const authorNames = (
      await Promise.all(
        (d.authors ?? []).slice(0, 3).map(async (a) => {
          try {
            const ar = await fetchWithTimeout(`https://openlibrary.org${a.key}.json`);
            if (!ar.ok) return null;
            const aj: { name?: string } = await ar.json();
            return aj.name ?? null;
          } catch {
            return null;
          }
        }),
      )
    ).filter(Boolean) as string[];
    const lang = d.languages?.[0]?.key.split("/").pop();
    return {
      source: "openlibrary",
      external_id: d.works?.[0]?.key ?? clean,
      title: d.title || "Brak tytułu",
      subtitle: d.subtitle,
      author: authorNames[0] ?? "Brak autora",
      authors: authorNames.length ? authorNames : undefined,
      isbn: clean,
      isbn13: clean.length === 13 ? clean : undefined,
      isbn10: clean.length === 10 ? clean : undefined,
      cover_url: d.covers?.[0] ? olCoverById(d.covers[0]) : undefined,
      page_count: d.number_of_pages,
      published_date: d.publish_date,
      category: d.subjects?.[0],
      subjects: d.subjects?.slice(0, 8),
      description: typeof d.description === "string" ? d.description : d.description?.value,
      publisher: d.publishers?.[0],
      language: mapOLLang(lang),
      info_url: `https://openlibrary.org/isbn/${clean}`,
    };
  } catch {
    return null;
  }
}

export async function lookupByIsbnServer(isbn: string): Promise<BookSearchResult | null> {
  const clean = isbn.replace(/[^0-9X]/gi, "");
  if (!clean) return null;
  const key = `isbn:${clean}`;
  return withCache(key, SEARCH_TTL_MS, async () => {
    // Fan out to all three sources in parallel — the previous implementation
    // ran OL detail first and then GB+BN after, which doubled the wait
    // when the OL endpoint was slow.
    const [olResult, gbSettled, bnSettled] = await Promise.allSettled([
      fetchOLIsbn(clean),
      searchGoogleBooks(`isbn:${clean}`),
      lookupBNByIsbn(clean),
    ]);
    const olR = olResult.status === "fulfilled" ? olResult.value : null;
    const gbR = gbSettled.status === "fulfilled" ? (gbSettled.value[0] ?? null) : null;
    const bnR = bnSettled.status === "fulfilled" ? bnSettled.value : null;
    let result: BookSearchResult | null = null;
    for (const candidate of [olR, gbR, bnR]) {
      if (!candidate) continue;
      result = result ? mergeResults(result, candidate) : candidate;
    }
    // `enrichCover` owns the full chain (see `searchBooksServer`): an
    // existing GB cover wins, then a GB-by-ISBN upgrade pass for OL
    // covers, then the OL ISBN URL fallback.
    return result ? enrichCover(result) : null;
  });
}

export async function enrichBookDetailsServer(r: BookSearchResult): Promise<BookSearchResult> {
  try {
    if (r.source === "google") {
      const res = await fetchWithTimeout(
        `https://www.googleapis.com/books/v1/volumes/${encodeURIComponent(r.external_id)}`,
      );
      if (!res.ok) return r;
      const v = (await res.json()) as GBVolume;
      // GB detail typically has imageLinks — `enrichCover` sees an
      // existing `cover_url` and short-circuits. If GB detail was
      // missing imageLinks, the second-source pass still runs.
      return enrichCover(mergeResults(r, mapGoogleVolume(v)));
    }
    let enriched: BookSearchResult = r;
    if (r.source === "openlibrary" && r.external_id.startsWith("/works/")) {
      const res = await fetchWithTimeout(`https://openlibrary.org${r.external_id}.json`);
      if (res.ok) {
        const d = (await res.json()) as {
          description?: string | { value: string };
          subjects?: string[];
          first_sentence?: string | { value: string };
        };
        const desc = typeof d.description === "string" ? d.description : d.description?.value;
        const fs =
          typeof d.first_sentence === "string" ? d.first_sentence : d.first_sentence?.value;
        enriched = {
          ...enriched,
          description: enriched.description ?? desc,
          category: enriched.category ?? d.subjects?.[0],
          subjects: enriched.subjects?.length ? enriched.subjects : d.subjects?.slice(0, 8),
          first_sentence: enriched.first_sentence ?? fs,
        };
      }
    }
    // For Open Library / BN results, pull cover/rating/preview from Google by ISBN.
    if (r.isbn && (r.source === "openlibrary" || r.source === "bn")) {
      try {
        const gb = await searchGoogleBooks(`isbn:${r.isbn}`);
        if (gb[0]) enriched = mergeResults(enriched, gb[0]);
      } catch {
        /* ignore */
      }
    }
    return enrichCover(enriched);
  } catch {
    return r;
  }
}
