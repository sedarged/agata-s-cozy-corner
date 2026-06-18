// Real external book search:
//  - Title/author: Google Books (primary) + Open Library (merge/fallback)
//  - ISBN: Open Library (primary) + Google Books (fallback/enrichment)
// Both APIs are public, CORS-enabled, no key required. No paid APIs.
// Polish-language and complete-metadata results are ranked higher.

export interface BookSearchResult {
  source: "openlibrary" | "google";
  external_id: string;
  title: string;
  author: string;
  isbn?: string;
  cover_url?: string;
  description?: string;
  page_count?: number;
  published_date?: string;
  category?: string;
  publisher?: string;
  language?: string;
}

interface OLDoc {
  key: string;
  title: string;
  author_name?: string[];
  isbn?: string[];
  cover_i?: number;
  first_publish_year?: number;
  number_of_pages_median?: number;
  subject?: string[];
  publisher?: string[];
  language?: string[];
}

interface GBVolume {
  id: string;
  volumeInfo: {
    title?: string;
    authors?: string[];
    description?: string;
    pageCount?: number;
    publishedDate?: string;
    industryIdentifiers?: { type: string; identifier: string }[];
    imageLinks?: { thumbnail?: string; smallThumbnail?: string };
    categories?: string[];
    publisher?: string;
    language?: string;
  };
}

function mapOLLang(l?: string): string | undefined {
  // Open Library uses MARC codes ("pol", "eng", …); normalise to ISO-639-1.
  if (!l) return undefined;
  const v = l.toLowerCase();
  if (v === "pol" || v === "pl") return "pl";
  if (v === "eng" || v === "en") return "en";
  if (v === "ger" || v === "deu" || v === "de") return "de";
  if (v === "fre" || v === "fra" || v === "fr") return "fr";
  return v.slice(0, 2);
}

async function searchOpenLibrary(q: string): Promise<BookSearchResult[]> {
  const url = `https://openlibrary.org/search.json?q=${encodeURIComponent(q)}&limit=15`;
  const res = await fetch(url);
  if (!res.ok) return [];
  const json = (await res.json()) as { docs: OLDoc[] };
  return json.docs.map((d) => ({
    source: "openlibrary" as const,
    external_id: d.key,
    title: d.title || "Brak tytułu",
    author: d.author_name?.[0] ?? "Brak autora",
    isbn: d.isbn?.[0],
    cover_url: d.cover_i ? `https://covers.openlibrary.org/b/id/${d.cover_i}-L.jpg` : undefined,
    page_count: d.number_of_pages_median,
    published_date: d.first_publish_year ? String(d.first_publish_year) : undefined,
    category: d.subject?.[0],
    publisher: d.publisher?.[0],
    language: mapOLLang(d.language?.[0]),
  }));
}

async function searchGoogleBooks(q: string, opts?: { polishFirst?: boolean }): Promise<BookSearchResult[]> {
  // Ask Google Books to prefer Polish results when we're querying for a
  // human-typed title/author, but fall back to a plain search if the
  // Polish-restricted query returns nothing.
  const base = `https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(q)}&maxResults=15`;
  const tryUrl = async (url: string): Promise<BookSearchResult[]> => {
    const res = await fetch(url);
    if (!res.ok) return [];
    const json = (await res.json()) as { items?: GBVolume[] };
    return (json.items ?? []).map((v) => {
      const info = v.volumeInfo;
      const isbn = info.industryIdentifiers?.find((i) => i.type.includes("ISBN"))?.identifier;
      const cover = info.imageLinks?.thumbnail?.replace("http://", "https://");
      return {
        source: "google" as const,
        external_id: v.id,
        title: info.title ?? "Brak tytułu",
        author: info.authors?.[0] ?? "Brak autora",
        isbn,
        cover_url: cover,
        description: info.description,
        page_count: info.pageCount,
        published_date: info.publishedDate,
        category: info.categories?.[0],
        publisher: info.publisher,
        language: info.language?.toLowerCase(),
      };
    });
  };
  if (opts?.polishFirst) {
    const pl = await tryUrl(`${base}&langRestrict=pl`);
    if (pl.length > 0) {
      const more = await tryUrl(base);
      // Polish-restricted results first, dedup the rest by id.
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
  const qn = q.toLowerCase();
  if (qn && r.title?.toLowerCase().includes(qn)) s += 2;
  if (qn && r.author?.toLowerCase().includes(qn)) s += 1;
  // Google Books is usually richer for modern Polish editions → slight edge.
  if (r.source === "google") s += 0.5;
  return s;
}

export async function searchBooks(q: string): Promise<BookSearchResult[]> {
  if (!q.trim()) return [];
  // Google Books is primary for title/author search (better Polish editions).
  // Open Library is merged as secondary/fallback.
  const [gb, ol] = await Promise.allSettled([
    searchGoogleBooks(q, { polishFirst: true }),
    searchOpenLibrary(q),
  ]);
  const gbResults = gb.status === "fulfilled" ? gb.value : [];
  const olResults = ol.status === "fulfilled" ? ol.value : [];
  const byKey = new Map<string, BookSearchResult>();
  for (const r of [...gbResults, ...olResults]) {
    const k = normalizeKey(r);
    const existing = byKey.get(k);
    if (!existing) {
      byKey.set(k, r);
    } else {
      // Merge: prefer the entry with more metadata.
      byKey.set(k, {
        ...existing,
        cover_url: existing.cover_url ?? r.cover_url,
        description: existing.description ?? r.description,
        page_count: existing.page_count ?? r.page_count,
        published_date: existing.published_date ?? r.published_date,
        category: existing.category ?? r.category,
        publisher: existing.publisher ?? r.publisher,
        language: existing.language ?? r.language,
        isbn: existing.isbn ?? r.isbn,
      });
    }
  }
  const merged = Array.from(byKey.values());
  merged.sort((a, b) => scoreResult(b, q) - scoreResult(a, q));
  return merged;
}

export async function lookupByIsbn(isbn: string): Promise<BookSearchResult | null> {
  const clean = isbn.replace(/[^0-9X]/gi, "");
  if (!clean) return null;
  // Open Library ISBN endpoint — primary.
  let olResult: BookSearchResult | null = null;
  try {
    const res = await fetch(`https://openlibrary.org/isbn/${clean}.json`);
    if (res.ok) {
      const d: {
        title: string;
        authors?: { key: string }[];
        number_of_pages?: number;
        publish_date?: string;
        covers?: number[];
        subjects?: string[];
        description?: string | { value: string };
        publishers?: string[];
        languages?: { key: string }[];
      } = await res.json();
      let author = "Brak autora";
      if (d.authors?.[0]) {
        try {
          const a = await fetch(`https://openlibrary.org${d.authors[0].key}.json`);
          if (a.ok) {
            const aj: { name?: string } = await a.json();
            author = aj.name ?? author;
          }
        } catch {
          /* author enrichment best-effort */
        }
      }
      const lang = d.languages?.[0]?.key.split("/").pop();
      olResult = {
        source: "openlibrary",
        external_id: clean,
        title: d.title || "Brak tytułu",
        author,
        isbn: clean,
        cover_url: d.covers?.[0]
          ? `https://covers.openlibrary.org/b/id/${d.covers[0]}-L.jpg`
          : undefined,
        page_count: d.number_of_pages,
        published_date: d.publish_date,
        category: d.subjects?.[0],
        description: typeof d.description === "string" ? d.description : d.description?.value,
        publisher: d.publishers?.[0],
        language: mapOLLang(lang),
      };
    }
  } catch {
    /* fall through to Google Books */
  }
  // Always try Google Books too — used as fallback when OL fails, and as
  // enrichment when OL is missing description / cover / pageCount / publisher.
  let gbResult: BookSearchResult | null = null;
  try {
    const gb = await searchGoogleBooks(`isbn:${clean}`);
    gbResult = gb[0] ?? null;
  } catch {
    /* network */
  }
  if (!olResult && !gbResult) return null;
  if (olResult && !gbResult) return olResult;
  if (!olResult && gbResult) return gbResult;
  // Merge — OL leads, Google enriches missing fields.
  return {
    ...olResult!,
    cover_url: olResult!.cover_url ?? gbResult!.cover_url,
    description: olResult!.description ?? gbResult!.description,
    page_count: olResult!.page_count ?? gbResult!.page_count,
    published_date: olResult!.published_date ?? gbResult!.published_date,
    category: olResult!.category ?? gbResult!.category,
    publisher: olResult!.publisher ?? gbResult!.publisher,
    language: olResult!.language ?? gbResult!.language,
  };
}
