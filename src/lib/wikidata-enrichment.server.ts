// Agata — Wikidata enrichment helper (server-only).
// Fire-and-forget provider that, after a book create/update, asks Wikidata
// for a matching item by title, takes the top hit, and writes the qid +
// Wikidata blurb back to the book row. Never blocks the create/update path:
// callers invoke this as `void enrichBookAsync(...)` and treat any failure
// as a soft miss (logged, swallowed).
//
// Opt-in: by default the helper is a no-op. The operator enables it via
// `WIKIDATA_ENRICHMENT_ENABLED=true` in <ENV_FILE>. Defaulting off is the
// privacy-first choice — every call is an external HTTP request that
// Wikidata logs, and we want the operator to make that an explicit decision.
//
// Failure model: every network error, timeout, non-2xx, malformed JSON, and
// empty hit returns `null`. Nothing throws out of this module — enrichment
// is best-effort and the calling create/update path must not crash if
// Wikidata is unreachable.
import "@tanstack/react-start/server-only";

import { applyWikidataEnrichment } from "@/lib/db/repositories/books";

// ---------- public DTO ----------
export interface WikidataHit {
  qid: string;
  label: string;
  description?: string;
}

export interface EnrichBookInput {
  title: string;
  /** Optional — currently unused for ranking, kept for future author-aware search. */
  author?: string;
  /** Optional ISBN — Wikidata doesn't index by ISBN directly so we ignore it. */
  isbn?: string;
}

// ---------- internals ----------
const WIKIDATA_ENDPOINT = "https://www.wikidata.org/w/api.php";
const WIKIDATA_TIMEOUT_MS = 5_000;
const MAX_TITLE_LENGTH = 256;

interface WikidataSearchResponse {
  search?: Array<{
    id?: string;
    label?: string;
    description?: string;
  }>;
}

/**
 * True when the operator has enabled Wikidata enrichment. Off by default.
 *
 * Reading `process.env` per call is cheap; the env var is checked once
 * inside `enrichBookAsync` so callers don't need to gate at the call site.
 */
export function isWikidataEnrichmentEnabled(): boolean {
  return process.env.WIKIDATA_ENRICHMENT_ENABLED?.trim() === "true";
}

/**
 * Fetch the top Wikidata hit for `title`. Hard 5s timeout. Returns `null`
 * on any non-2xx, malformed JSON, empty `search[]`, or timeout.
 *
 * Exported for unit testing — `wikidata-enrichment.spec.ts` mocks
 * `globalThis.fetch` to drive every branch without ever hitting the
 * network.
 */
export async function searchWikidata(input: EnrichBookInput): Promise<WikidataHit | null> {
  const title = (input.title ?? "").trim();
  if (!title) return null;
  // Cap the search payload — Wikidata's `wbsearchentities` rejects nothing
  // but a 100KB title is a sign of a bug we don't want to amplify.
  if (title.length > MAX_TITLE_LENGTH) return null;

  const url = new URL(WIKIDATA_ENDPOINT);
  url.searchParams.set("action", "wbsearchentities");
  url.searchParams.set("search", title);
  url.searchParams.set("language", "en");
  url.searchParams.set("format", "json");
  url.searchParams.set("limit", "5");
  url.searchParams.set("type", "item");

  let res: Response;
  try {
    res = await fetch(url, { signal: AbortSignal.timeout(WIKIDATA_TIMEOUT_MS) });
  } catch {
    return null;
  }
  if (!res.ok) return null;

  let json: WikidataSearchResponse;
  try {
    json = (await res.json()) as WikidataSearchResponse;
  } catch {
    return null;
  }
  const first = json.search?.[0];
  if (!first?.id) return null;
  return {
    qid: first.id,
    label: first.label ?? "",
    description: first.description,
  };
}

/**
 * Fire-and-forget enrichment. Returns the hit that was applied (or `null`
 * for any soft miss). Never throws — the whole body is wrapped so a
 * single bug cannot bubble out and break the calling create/update path.
 *
 * Side effects on success: writes `wikidata_id`, `wikidata_description`,
 * and `enriched_at` to the books row via `applyWikidataEnrichment`. When
 * the feature flag is off, the call is a no-op (and avoids the network).
 */
export async function enrichBookAsync(
  bookId: string,
  input: EnrichBookInput,
): Promise<WikidataHit | null> {
  if (!isWikidataEnrichmentEnabled()) return null;
  try {
    const hit = await searchWikidata(input);
    if (!hit) return null;
    await applyWikidataEnrichment(bookId, {
      wikidataId: hit.qid,
      wikidataDescription: hit.description ?? null,
    });
    return hit;
  } catch (err) {
    // Soft-fail: log in non-test environments, swallow.
    if (process.env.NODE_ENV !== "test") {
      console.warn(`[wikidata] enrichment failed for ${bookId}:`, err);
    }
    return null;
  }
}
