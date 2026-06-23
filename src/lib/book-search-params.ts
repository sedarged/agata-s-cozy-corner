// book-search-params.ts — query-string parsing and pagination for the
// /api/book-search endpoint. Pure, no I/O.

import type { BookSearchSource } from "./book-search-types";

export const DEFAULT_PAGE_SIZE = 20;
export const MAX_PAGE_SIZE = 50;

export interface SearchParams {
  q?: string;
  isbn?: string;
  page: number;
  pageSize: number;
  /**
   * When set, restrict results to these sources. When undefined, the
   * route runs the default fan-out across all three.
   */
  sources?: BookSearchSource[];
}

export type ParseResult = { ok: true; params: SearchParams } | { ok: false; error: string };

const ALL_SOURCES: BookSearchSource[] = ["openlibrary", "google", "bn"];

function coerceInt(v: string | null, fallback: number, opts: { min?: number; max?: number }) {
  if (v == null) return fallback;
  const n = parseInt(v, 10);
  if (!Number.isFinite(n)) return fallback;
  const min = opts.min ?? 1;
  const max = opts.max ?? Number.MAX_SAFE_INTEGER;
  return Math.max(min, Math.min(max, n));
}

export function parseSearchParams(qs: URLSearchParams): ParseResult {
  const rawQ = qs.get("q");
  const rawIsbn = qs.get("isbn");
  const q = (rawQ ?? "").trim();
  const isbn = (rawIsbn ?? "").trim() || undefined;
  if (!q && !isbn) {
    return { ok: false, error: "Provide a 'q' or 'isbn' query parameter." };
  }
  const page = coerceInt(qs.get("page"), 1, { min: 1 });
  const pageSize = coerceInt(qs.get("pageSize"), DEFAULT_PAGE_SIZE, {
    min: 1,
    max: MAX_PAGE_SIZE,
  });
  const sources = parseSources(qs.get("source"));
  return {
    ok: true,
    params: {
      q: q || undefined,
      isbn,
      page,
      pageSize,
      sources,
    },
  };
}

function parseSources(raw: string | null): BookSearchSource[] | undefined {
  if (!raw) return undefined;
  const parts = raw
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  const valid = parts.filter((p): p is BookSearchSource => (ALL_SOURCES as string[]).includes(p));
  if (valid.length === 0) return undefined;
  return Array.from(new Set(valid));
}

export interface Page<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}

export function paginate<T>(all: T[], page: number, pageSize: number): Page<T> {
  const total = all.length;
  const start = (page - 1) * pageSize;
  const items = start >= total ? [] : all.slice(start, start + pageSize);
  return {
    items,
    total,
    page,
    pageSize,
    hasMore: start + items.length < total,
  };
}

/**
 * Filter a merged result list down to only the requested sources.
 * No-op if `sources` is undefined.
 */
export function filterBySource<T extends { source: BookSearchSource }>(
  items: T[],
  sources?: BookSearchSource[],
): T[] {
  if (!sources || sources.length === 0) return items;
  const set = new Set(sources);
  return items.filter((r) => set.has(r.source));
}
