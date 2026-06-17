// Open Library + Google Books search — both CORS-enabled, no key required.

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
  };
}

async function searchOpenLibrary(q: string): Promise<BookSearchResult[]> {
  const url = `https://openlibrary.org/search.json?q=${encodeURIComponent(q)}&limit=15`;
  const res = await fetch(url);
  if (!res.ok) return [];
  const json = (await res.json()) as { docs: OLDoc[] };
  return json.docs.map((d) => ({
    source: "openlibrary" as const,
    external_id: d.key,
    title: d.title,
    author: d.author_name?.[0] ?? "Unknown",
    isbn: d.isbn?.[0],
    cover_url: d.cover_i ? `https://covers.openlibrary.org/b/id/${d.cover_i}-L.jpg` : undefined,
    page_count: d.number_of_pages_median,
    published_date: d.first_publish_year ? String(d.first_publish_year) : undefined,
    category: d.subject?.[0],
  }));
}

async function searchGoogleBooks(q: string): Promise<BookSearchResult[]> {
  const url = `https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(q)}&maxResults=15`;
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
      title: info.title ?? "Untitled",
      author: info.authors?.[0] ?? "Unknown",
      isbn,
      cover_url: cover,
      description: info.description,
      page_count: info.pageCount,
      published_date: info.publishedDate,
      category: info.categories?.[0],
    };
  });
}

export async function searchBooks(q: string): Promise<BookSearchResult[]> {
  if (!q.trim()) return [];
  const [ol, gb] = await Promise.allSettled([searchOpenLibrary(q), searchGoogleBooks(q)]);
  const olResults = ol.status === "fulfilled" ? ol.value : [];
  const gbResults = gb.status === "fulfilled" ? gb.value : [];
  // Merge, prefer OpenLibrary if same ISBN; otherwise interleave.
  const seen = new Set<string>();
  const merged: BookSearchResult[] = [];
  for (const r of [...olResults, ...gbResults]) {
    const key = r.isbn ?? `${r.title}::${r.author}`;
    if (seen.has(key)) continue;
    seen.add(key);
    merged.push(r);
  }
  return merged;
}

export async function lookupByIsbn(isbn: string): Promise<BookSearchResult | null> {
  const clean = isbn.replace(/[^0-9X]/gi, "");
  if (!clean) return null;
  // Open Library ISBN endpoint
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
      } = await res.json();
      let author = "Unknown";
      if (d.authors?.[0]) {
        const a = await fetch(`https://openlibrary.org${d.authors[0].key}.json`);
        if (a.ok) {
          const aj: { name?: string } = await a.json();
          author = aj.name ?? author;
        }
      }
      return {
        source: "openlibrary",
        external_id: clean,
        title: d.title,
        author,
        isbn: clean,
        cover_url: d.covers?.[0] ? `https://covers.openlibrary.org/b/id/${d.covers[0]}-L.jpg` : undefined,
        page_count: d.number_of_pages,
        published_date: d.publish_date,
        category: d.subjects?.[0],
        description: typeof d.description === "string" ? d.description : d.description?.value,
      };
    }
  } catch { /* fall through */ }
  // Fallback
  const gb = await searchGoogleBooks(`isbn:${clean}`);
  return gb[0] ?? null;
}
