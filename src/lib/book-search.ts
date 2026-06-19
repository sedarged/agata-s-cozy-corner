// Real external book search:
//  - Title/author: Google Books (primary) + Open Library (merge/fallback)
//  - ISBN: Open Library (primary) + Google Books (fallback/enrichment)
// Both APIs are public, CORS-enabled, no key required. No paid APIs.
// Polish-language and complete-metadata results are ranked higher.

export interface BookSearchResult {
  source: "openlibrary" | "google";
  external_id: string;
  title: string;
  subtitle?: string;
  author: string;
  authors?: string[];
  isbn?: string;
  isbn10?: string;
  isbn13?: string;
  cover_url?: string;
  description?: string;
  page_count?: number;
  published_date?: string;
  category?: string;
  subjects?: string[];
  publisher?: string;
  language?: string;
  rating?: number;
  ratings_count?: number;
  edition_count?: number;
  first_sentence?: string;
  preview_url?: string;
  info_url?: string;
  buy_url?: string;
  read_online_url?: string;
  maturity_rating?: string;
}

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

function mapOLLang(l?: string): string | undefined {
  if (!l) return undefined;
  const v = l.toLowerCase();
  if (v === "pol" || v === "pl") return "pl";
  if (v === "eng" || v === "en") return "en";
  if (v === "ger" || v === "deu" || v === "de") return "de";
  if (v === "fre" || v === "fra" || v === "fr") return "fr";
  return v.slice(0, 2);
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
      ? `https://covers.openlibrary.org/b/id/${d.cover_i}-L.jpg`
      : d.cover_edition_key
        ? `https://covers.openlibrary.org/b/olid/${d.cover_edition_key}-L.jpg`
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

function normalizeKey(r: BookSearchResult): string {
  const isbn = (r.isbn || "").replace(/[^0-9Xx]/g, "");
  if (isbn) return `isbn:${isbn}`;
  const t = (r.title || "").toLowerCase().replace(/\s+/g, " ").trim();
  const a = (r.author || "").toLowerCase().replace(/\s+/g, " ").trim();
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
  const qn = q.toLowerCase();
  if (qn && r.title?.toLowerCase().includes(qn)) s += 2;
  if (qn && r.author?.toLowerCase().includes(qn)) s += 1;
  if (r.source === "google") s += 0.5;
  return s;
}

// Simple in-memory cache (per session) with 10-min TTL.
const cache = new Map<string, { at: number; data: unknown }>();
const CACHE_TTL = 10 * 60 * 1000;
function getCached<T>(key: string): T | undefined {
  const e = cache.get(key);
  if (!e) return undefined;
  if (Date.now() - e.at > CACHE_TTL) {
    cache.delete(key);
    return undefined;
  }
  return e.data as T;
}
function setCached(key: string, data: unknown) {
  cache.set(key, { at: Date.now(), data });
}

export async function searchBooks(q: string): Promise<BookSearchResult[]> {
  if (!q.trim()) return [];
  const key = `search:${q.trim().toLowerCase()}`;
  const cached = getCached<BookSearchResult[]>(key);
  if (cached) return cached;
  const [gb, ol] = await Promise.allSettled([
    searchGoogleBooks(q, { polishFirst: true }),
    searchOpenLibrary(q, { polish: /[ąćęłńóśźż]/i.test(q) }),
  ]);
  const gbResults = gb.status === "fulfilled" ? gb.value : [];
  const olResults = ol.status === "fulfilled" ? ol.value : [];
  const byKey = new Map<string, BookSearchResult>();
  for (const r of [...gbResults, ...olResults]) {
    const k = normalizeKey(r);
    const existing = byKey.get(k);
    if (!existing) byKey.set(k, r);
    else byKey.set(k, mergeResults(existing, r));
  }
  const merged = Array.from(byKey.values());
  merged.sort((a, b) => scoreResult(b, q) - scoreResult(a, q));
  setCached(key, merged);
  return merged;
}

export async function lookupByIsbn(isbn: string): Promise<BookSearchResult | null> {
  const clean = isbn.replace(/[^0-9X]/gi, "");
  if (!clean) return null;
  const key = `isbn:${clean}`;
  const cached = getCached<BookSearchResult | null>(key);
  if (cached !== undefined) return cached;

  let olResult: BookSearchResult | null = null;
  try {
    const res = await fetchWithTimeout(`https://openlibrary.org/isbn/${clean}.json`);
    if (res.ok) {
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
      const authorNames: string[] = [];
      if (d.authors?.length) {
        for (const a of d.authors.slice(0, 3)) {
          try {
            const ar = await fetchWithTimeout(`https://openlibrary.org${a.key}.json`);
            if (ar.ok) {
              const aj: { name?: string } = await ar.json();
              if (aj.name) authorNames.push(aj.name);
            }
          } catch {
            /* ignore */
          }
        }
      }
      const lang = d.languages?.[0]?.key.split("/").pop();
      olResult = {
        source: "openlibrary",
        external_id: d.works?.[0]?.key ?? clean,
        title: d.title || "Brak tytułu",
        subtitle: d.subtitle,
        author: authorNames[0] ?? "Brak autora",
        authors: authorNames.length ? authorNames : undefined,
        isbn: clean,
        isbn13: clean.length === 13 ? clean : undefined,
        isbn10: clean.length === 10 ? clean : undefined,
        cover_url: d.covers?.[0]
          ? `https://covers.openlibrary.org/b/id/${d.covers[0]}-L.jpg`
          : `https://covers.openlibrary.org/b/isbn/${clean}-L.jpg?default=false`,
        page_count: d.number_of_pages,
        published_date: d.publish_date,
        category: d.subjects?.[0],
        subjects: d.subjects?.slice(0, 8),
        description: typeof d.description === "string" ? d.description : d.description?.value,
        publisher: d.publishers?.[0],
        language: mapOLLang(lang),
        info_url: `https://openlibrary.org/isbn/${clean}`,
      };
    }
  } catch {
    /* fall through */
  }

  let gbResult: BookSearchResult | null = null;
  try {
    const gb = await searchGoogleBooks(`isbn:${clean}`);
    gbResult = gb[0] ?? null;
  } catch {
    /* network */
  }

  let result: BookSearchResult | null;
  if (!olResult && !gbResult) result = null;
  else if (olResult && !gbResult) result = olResult;
  else if (!olResult && gbResult) result = gbResult;
  else result = mergeResults(olResult!, gbResult!);

  setCached(key, result);
  return result;
}

export async function enrichBookDetails(r: BookSearchResult): Promise<BookSearchResult> {
  const key = `enrich:${r.source}:${r.external_id}`;
  const cached = getCached<BookSearchResult>(key);
  if (cached) return cached;
  try {
    if (r.source === "google") {
      const res = await fetchWithTimeout(
        `https://www.googleapis.com/books/v1/volumes/${encodeURIComponent(r.external_id)}`,
      );
      if (!res.ok) return r;
      const v = (await res.json()) as GBVolume;
      const enriched = mergeResults(r, mapGoogleVolume(v));
      setCached(key, enriched);
      return enriched;
    }
    if (r.source === "openlibrary" && r.external_id.startsWith("/works/")) {
      const res = await fetchWithTimeout(`https://openlibrary.org${r.external_id}.json`);
      let enriched: BookSearchResult = r;
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
          ...r,
          description: r.description ?? desc,
          category: r.category ?? d.subjects?.[0],
          subjects: r.subjects?.length ? r.subjects : d.subjects?.slice(0, 8),
          first_sentence: r.first_sentence ?? fs,
        };
      }
      // Try Google Books too (cover, rating, preview) via ISBN.
      if (r.isbn) {
        try {
          const gb = await searchGoogleBooks(`isbn:${r.isbn}`);
          if (gb[0]) enriched = mergeResults(enriched, gb[0]);
        } catch {
          /* ignore */
        }
      }
      setCached(key, enriched);
      return enriched;
    }
  } catch {
    /* best-effort */
  }
  return r;
}

export function sourceLabel(s: BookSearchResult["source"]): string {
  return s === "google" ? "Google Books" : "Open Library";
}

export function sourceUrl(r: BookSearchResult): string | null {
  if (r.info_url) return r.info_url;
  if (r.source === "google")
    return `https://books.google.com/books?id=${encodeURIComponent(r.external_id)}`;
  if (r.source === "openlibrary" && r.external_id.startsWith("/"))
    return `https://openlibrary.org${r.external_id}`;
  if (r.source === "openlibrary" && r.isbn) return `https://openlibrary.org/isbn/${r.isbn}`;
  return null;
}
