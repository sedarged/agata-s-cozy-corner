// book-search-params.ts — query-string parsing and pagination for the
// /api/book-search endpoint. Pure, no I/O.

import type { BookSearchSource } from "./book-search-types";

export const DEFAULT_PAGE_SIZE = 20;
export const MAX_PAGE_SIZE = 50;

/**
 * Length caps on user-supplied query strings. Without these, a hostile
 * client can send `q=` followed by hundreds of KB and the upstream
 * `Promise.allSettled` fan-out amplifies the cost 3-way (GB + OL + BN).
 * `q=200` covers the longest plausible Polish title + author + section.
 * `isbn=32` is generous — ISBN-13 + hyphens never exceeds 17 chars.
 */
const MAX_Q_LENGTH = 200;
const MAX_ISBN_LENGTH = 32;

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
  if (q.length > MAX_Q_LENGTH) {
    return { ok: false, error: `Query parameter 'q' is too long (max ${MAX_Q_LENGTH} chars).` };
  }
  if (isbn && isbn.length > MAX_ISBN_LENGTH) {
    return {
      ok: false,
      error: `Query parameter 'isbn' is too long (max ${MAX_ISBN_LENGTH} chars).`,
    };
  }
  const page = coerceInt(qs.get("page"), 1, { min: 1 });
  const pageSize = coerceInt(qs.get("pageSize"), DEFAULT_PAGE_SIZE, {
    min: 1,
    max: MAX_PAGE_SIZE,
  });
  const sourcesResult = parseSources(qs.get("source"));
  if (sourcesResult !== undefined && !Array.isArray(sourcesResult)) {
    return { ok: false, error: sourcesResult.error };
  }
  const sources = sourcesResult as BookSearchSource[] | undefined;
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

function parseSources(raw: string | null): BookSearchSource[] | undefined | { error: string } {
  if (!raw) return undefined;
  const parts = raw
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  if (parts.length === 0) return undefined;
  // Strict mode (post-2026-06-25): any invalid source rejects the whole
  // request with the offending value surfaced in the error. Pre-fix
  // silently dropped them — operators couldn't tell their dashboard
  // typo (`source=gogle`) was turning into "all sources".
  const invalid = parts.filter((p) => !(ALL_SOURCES as string[]).includes(p));
  if (invalid.length > 0) {
    return {
      error: `Invalid source value(s): ${invalid.join(", ")}. Allowed: ${ALL_SOURCES.join(", ")}.`,
    };
  }
  return Array.from(new Set(parts)) as BookSearchSource[];
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
