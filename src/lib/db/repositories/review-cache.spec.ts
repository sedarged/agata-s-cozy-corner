// Agata — review_cache schema spec.
//
// `review_cache` stores per-(book, source) provider responses with a
// `fetched_at` timestamp so the social-proof fetcher can decide whether
// to call upstream or replay the cached row. The TTL is driven by
// `BOOK_PROVIDER_CACHE_TTL_DAYS` env (default 7) — the repo enforces
// it via `isCacheStale(fetchedAt, ttlDays)`.
//
// Pin: schema columns + repo invariants that the route layer relies on
// for cache-hit short-circuiting. A future schema change that drops
// `fetched_at` or renames `source` would silently break the route's
// stale-check, so we assert the surface here.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { isCacheStale, reviewCacheTtlDaysFromEnv } from "./review-cache";

const here = dirname(fileURLToPath(import.meta.url));
const migration = readFileSync(resolve(here, "../../../../drizzle/0006_review_cache.sql"), "utf8");

test("0006_review_cache.sql creates review_cache + provider_sources tables", () => {
  assert.match(migration, /CREATE TABLE[^;]*review_cache/);
  assert.match(migration, /CREATE TABLE[^;]*provider_sources/);
});

test("review_cache primary key is (book_id, source)", () => {
  assert.match(migration, /PRIMARY KEY[^;]*book_id/);
  assert.match(migration, /PRIMARY KEY[^;]*source/);
});

test("review_cache has fetched_at column for TTL comparisons", () => {
  assert.match(migration, /fetched_at/);
});

test("review_cache.book_id references books(id) ON DELETE CASCADE", () => {
  // Substring check: the FK clause is emitted by Drizzle with
  // backticks, multi-line whitespace, etc. We just want to confirm
  // (a) a FK on book_id pointing at books and (b) the cascade rule.
  assert.match(migration, /FOREIGN KEY.*book_id.*REFERENCES.*books.*id/s);
  assert.match(migration, /ON DELETE cascade/i);
});

test("isCacheStale returns true when fetchedAt is older than ttlDays", () => {
  const oneWeekAgo = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000).toISOString();
  assert.equal(isCacheStale(oneWeekAgo, 7), true);
});

test("isCacheStale returns false when fetchedAt is within ttlDays", () => {
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  assert.equal(isCacheStale(oneHourAgo, 7), false);
});

test("isCacheStale returns true when fetchedAt is empty (never fetched)", () => {
  assert.equal(isCacheStale("", 7), true);
});

test("isCacheStale returns true when fetchedAt is malformed", () => {
  assert.equal(isCacheStale("not-a-date", 7), true);
});

test("reviewCacheTtlDaysFromEnv defaults to 7 when env unset", () => {
  // Pass a value the env doesn't have by setting it to empty in-process.
  // Implementation uses Number(process.env.BOOK_PROVIDER_CACHE_TTL_DAYS) || 7.
  assert.equal(reviewCacheTtlDaysFromEnv({}), 7);
});

test("reviewCacheTtlDaysFromEnv reads BOOK_PROVIDER_CACHE_TTL_DAYS when set", () => {
  assert.equal(reviewCacheTtlDaysFromEnv({ BOOK_PROVIDER_CACHE_TTL_DAYS: "14" }), 14);
});

test("reviewCacheTtlDaysFromEnv falls back to 7 on non-numeric", () => {
  assert.equal(reviewCacheTtlDaysFromEnv({ BOOK_PROVIDER_CACHE_TTL_DAYS: "soon" }), 7);
});
