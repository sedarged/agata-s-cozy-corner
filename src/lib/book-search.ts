// Client book-search wrapper. The real work happens server-side
// (book-search.server.ts via /api/book-search) so library requests are reliable
// regardless of the browser's ad-blockers, CSP, or CORS. This module just calls
// our own endpoint and caches results per session.
import type { BookSearchResult, BookSearchSource } from "./book-search-types";

export type { BookSearchResult, BookSearchSource } from "./book-search-types";

function fetchWithTimeout(url: string, opts?: RequestInit, ms = 10_000): Promise<Response> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  return fetch(url, { ...opts, signal: ctrl.signal }).finally(() => clearTimeout(t));
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
  const query = q.trim();
  if (!query) return [];
  const key = `search:${query.toLowerCase()}`;
  const cached = getCached<BookSearchResult[]>(key);
  if (cached) return cached;
  const res = await fetchWithTimeout(`/api/book-search?q=${encodeURIComponent(query)}`).catch(
    (e: unknown) => {
      if (e instanceof Error && e.name === "AbortError")
        throw new Error("Przekroczono czas wyszukiwania — spróbuj ponownie.");
      throw e;
    },
  );
  if (!res.ok) throw new Error("book-search failed");
  // The API returns a paginated page { items, page, pageSize, total, hasMore };
  // callers (e.g. the add-book search tab) expect a flat array of results.
  const payload = (await res.json()) as { items?: BookSearchResult[] } & Record<string, unknown>;
  const data: BookSearchResult[] = Array.isArray(payload?.items) ? payload.items : [];
  setCached(key, data);
  return data;
}

export async function lookupByIsbn(isbn: string): Promise<BookSearchResult | null> {
  const clean = isbn.replace(/[^0-9X]/gi, "");
  if (!clean) return null;
  const key = `isbn:${clean}`;
  const cached = getCached<BookSearchResult | null>(key);
  if (cached !== undefined) return cached;
  const res = await fetchWithTimeout(`/api/book-search?isbn=${encodeURIComponent(clean)}`).catch(
    (e: unknown) => {
      if (e instanceof Error && e.name === "AbortError")
        throw new Error("Przekroczono czas wyszukiwania — spróbuj ponownie.");
      throw e;
    },
  );
  if (!res.ok) throw new Error("isbn lookup failed");
  const data = (await res.json()) as BookSearchResult | null;
  setCached(key, data);
  return data;
}

export async function enrichBookDetails(r: BookSearchResult): Promise<BookSearchResult> {
  const key = `enrich:${r.source}:${r.external_id}`;
  const cached = getCached<BookSearchResult>(key);
  if (cached) return cached;
  try {
    const res = await fetchWithTimeout("/api/book-search", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ result: r }),
    });
    if (!res.ok) return r;
    const data = (await res.json()) as BookSearchResult;
    setCached(key, data);
    return data;
  } catch {
    return r;
  }
}

export function sourceLabel(s: BookSearchSource): string {
  if (s === "google") return "Google Books";
  if (s === "bn") return "Biblioteka Narodowa";
  return "Open Library";
}

export function sourceUrl(r: BookSearchResult): string | null {
  if (r.info_url) return r.info_url;
  if (r.source === "google")
    return `https://books.google.com/books?id=${encodeURIComponent(r.external_id)}`;
  if (r.source === "openlibrary" && r.external_id.startsWith("/"))
    return `https://openlibrary.org${r.external_id}`;
  if (r.source === "openlibrary" && r.isbn) return `https://openlibrary.org/isbn/${r.isbn}`;
  if (r.source === "bn" && r.isbn)
    return `https://katalogi.bn.org.pl/discovery/search?query=any,contains,${encodeURIComponent(
      r.isbn,
    )}&vid=48OMNIS_NLOP:48OMNIS_NLOP`;
  return null;
}
