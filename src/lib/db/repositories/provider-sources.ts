// Agata — provider_sources repo (§9 polish plan).
//
// Records which social-proof providers are configured (env-gated) at
// boot. The UI uses this table to surface "NYT: niedostępne — brak
// klucza API" instead of silently 404'ing in the cache layer.
//
// `seedProviderSources(env)` is called once on server boot and is
// idempotent — running it again refreshes the `configured` flags and
// stamps `last_checked_at`.
import { getDb } from "../client";
import { providerSources } from "../schema";
import type { ProviderSourceRow } from "../types";

const nowIso = () => new Date().toISOString();

/** The five provider sources the brief wires up. */
const KNOWN_SOURCES = ["hardcover", "googleBooks", "openLibrary", "nyt", "libraryThing"] as const;

/** Env var names that gate each provider's availability. */
const ENV_FOR_SOURCE: Record<(typeof KNOWN_SOURCES)[number], string> = {
  hardcover: "HARDCOVER_TOKEN",
  googleBooks: "GOOGLE_BOOKS_API_KEY",
  openLibrary: "OPENLIBRARY_TOKEN", // optional; OL public API works without one
  nyt: "NYT_API_KEY",
  libraryThing: "LIBRARYTHING_TOKEN",
};

export function listProviderSources(): ProviderSourceRow[] {
  return getDb().select().from(providerSources).all() as ProviderSourceRow[];
}

/**
 * Upsert one row per known provider source with its current configured
 * flag. Idempotent — safe to call on every server boot.
 */
export function seedProviderSources(env: Record<string, string | undefined>): void {
  const checkedAt = nowIso();
  for (const source of KNOWN_SOURCES) {
    const configured = Boolean(env[ENV_FOR_SOURCE[source]]);
    getDb()
      .insert(providerSources)
      .values({ source, configured, lastCheckedAt: checkedAt })
      .onConflictDoUpdate({
        target: providerSources.source,
        set: { configured, lastCheckedAt: checkedAt },
      })
      .run();
  }
}
