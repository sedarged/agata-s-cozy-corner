// Agata — /api/books/:id/social-proof route spec.
//
// §9 cache: the route must replay a fresh cached row instead of calling
// upstream, and must call upstream + upsert when the row is stale or
// missing. We test the cache-hit short-circuit, the cache-miss
// upstream call, and the invalid-id / not-found error paths.
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import * as dbClient from "@/lib/db/client";
import * as booksRepo from "@/lib/db/repositories/books";
import * as reviewCacheRepo from "@/lib/db/repositories/review-cache-repo";
import { handleSocialProof, type SocialProofEnv } from "./$id.social-proof";
import type { BookSocialProofDTO } from "@/lib/social-proof.server";

let dataDir: string;
let prevDataDir: string | undefined;

test.before(() => {
  prevDataDir = process.env.DATA_DIR;
  dataDir = mkdtempSync(join(tmpdir(), "agata-sp-"));
  process.env.DATA_DIR = dataDir;
  migrate(dbClient.getDb(), { migrationsFolder: join(process.cwd(), "drizzle") });
  booksRepo.upsertBook({ id: "bk-1", title: "Test", author: "Author", isbn: "9780140449266" });
});

test.after(() => {
  dbClient.closeDb();
  process.env.DATA_DIR = prevDataDir;
  if (existsSync(dataDir)) rmSync(dataDir, { recursive: true, force: true });
});

test.beforeEach(() => {
  dbClient.getRawSqlite().exec("DELETE FROM review_cache;");
});

function makeFetchStub(proof: BookSocialProofDTO) {
  let calls = 0;
  const stub: SocialProofEnv["fetchFn"] = async () => {
    calls += 1;
    return proof;
  };
  return Object.assign(stub, { calls: () => calls });
}

const SAMPLE: BookSocialProofDTO = {
  bookId: "bk-1",
  averageRating: 4.3,
  ratingsCount: 100,
  reviewHighlights: [],
  sources: { hardcover: true },
  lastFetchedAt: new Date().toISOString(),
};

test("invalid-id → 400 + { error: 'invalid-id' }", async () => {
  const res = await handleSocialProof("x".repeat(129));
  assert.equal(res.status, 400);
  assert.deepEqual(await res.json(), { error: "invalid-id" });
});

test("not-found → 404 + { error: 'not-found' }", async () => {
  const res = await handleSocialProof("missing-id");
  assert.equal(res.status, 404);
  assert.deepEqual(await res.json(), { error: "not-found" });
});

test("cache miss → fetches upstream and upserts", async () => {
  const stub = makeFetchStub(SAMPLE);
  const res = await handleSocialProof("bk-1", { fetchFn: stub });
  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), SAMPLE);
  assert.equal(stub.calls(), 1);
  const cached = await reviewCacheRepo.getReviewCache({ bookId: "bk-1", source: "hardcover" });
  assert.ok(cached);
});

test("cache hit → replays without calling upstream", async () => {
  const stub = makeFetchStub(SAMPLE);
  // Warm the cache.
  await reviewCacheRepo.upsertReviewCache({ bookId: "bk-1", source: "hardcover", payload: SAMPLE });
  const res = await handleSocialProof("bk-1", { fetchFn: stub });
  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), SAMPLE);
  assert.equal(stub.calls(), 0);
});

test("stale cache → fetches upstream + upserts", async () => {
  const stub = makeFetchStub(SAMPLE);
  // Plant a row with a fetched_at 30 days in the past (default TTL = 7).
  const staleFetchedAt = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  dbClient
    .getRawSqlite()
    .prepare("INSERT INTO review_cache (book_id, source, payload, fetched_at) VALUES (?, ?, ?, ?)")
    .run("bk-1", "hardcover", JSON.stringify(SAMPLE), staleFetchedAt);

  const res = await handleSocialProof("bk-1", { fetchFn: stub });
  assert.equal(res.status, 200);
  assert.equal(stub.calls(), 1);
  const cached = await reviewCacheRepo.getReviewCache({ bookId: "bk-1", source: "hardcover" });
  assert.ok(cached);
  assert.notEqual(cached.fetchedAt, staleFetchedAt);
});

test("env override extends TTL — cached row is replayed within window", async () => {
  const stub = makeFetchStub(SAMPLE);
  // Plant a row 8 days old. Default TTL (7) would stale it; env TTL=30 keeps it fresh.
  const eightDaysAgo = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000).toISOString();
  dbClient
    .getRawSqlite()
    .prepare("INSERT INTO review_cache (book_id, source, payload, fetched_at) VALUES (?, ?, ?, ?)")
    .run("bk-1", "hardcover", JSON.stringify(SAMPLE), eightDaysAgo);

  const res = await handleSocialProof("bk-1", {
    fetchFn: stub,
    env: { BOOK_PROVIDER_CACHE_TTL_DAYS: "30" },
  });
  assert.equal(res.status, 200);
  assert.equal(stub.calls(), 0);
});
