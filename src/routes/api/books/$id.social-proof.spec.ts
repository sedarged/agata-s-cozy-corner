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

// §4.5 / §4.3: route must merge NYT critic reviews + LibraryThing tags
// onto the Hardcover row when those providers are configured. Each
// provider failing must not blank the UI.
test("merges NYT + LibraryThing highlights onto the Hardcover row", async () => {
  const stub = makeFetchStub(SAMPLE);
  const nytPillars: BookSocialProofDTO = {
    bookId: "bk-1",
    reviewHighlights: [
      { id: "nyt-1", source: "nyt", reviewType: "critic", summary: "Sharp essay." },
    ],
    sources: { nyt: true },
    lastFetchedAt: new Date().toISOString(),
  };
  const ltPillars: BookSocialProofDTO = {
    bookId: "bk-1",
    reviewHighlights: [
      { id: "lt-1", source: "librarything", reviewType: "tag", text: "Quick read." },
    ],
    sources: { libraryThing: true },
    lastFetchedAt: new Date().toISOString(),
  };
  const res = await handleSocialProof("bk-1", {
    fetchFn: stub,
    nytFn: async () => nytPillars,
    libraryThingFn: async () => ltPillars,
  });
  assert.equal(res.status, 200);
  const body = (await res.json()) as BookSocialProofDTO;
  assert.equal(body.sources.hardcover, true);
  assert.equal(body.sources.nyt, true);
  assert.equal(body.sources.libraryThing, true);
  assert.equal(body.reviewHighlights.length, 2);
  const sources = body.reviewHighlights.map((h) => h.source).sort();
  assert.deepEqual(sources, ["librarything", "nyt"]);
});

test("NYT + LibraryThing returning null must not fail the route", async () => {
  const stub = makeFetchStub(SAMPLE);
  const res = await handleSocialProof("bk-1", {
    fetchFn: stub,
    nytFn: async () => null,
    libraryThingFn: async () => null,
  });
  assert.equal(res.status, 200);
  const body = (await res.json()) as BookSocialProofDTO;
  assert.equal(body.sources.hardcover, true);
  assert.equal(body.sources.nyt, undefined);
  assert.equal(body.sources.libraryThing, undefined);
});

// Regression: code-review found that a warm Hardcover cache used to skip
// NYT/LT entirely. With the default 7-day TTL that meant any book with a
// fresh Hardcover row would NEVER show NYT critic or LibraryThing tag
// highlights until the cache expired. The fix: NYT/LT always run on
// every request, and only the Hardcover-only row is cached.
test("cache hit: NYT + LibraryThing still merge on the warm-cache fast path", async () => {
  const stub = makeFetchStub(SAMPLE);
  const nytPillars: BookSocialProofDTO = {
    bookId: "bk-1",
    reviewHighlights: [{ id: "nyt-1", source: "nyt", reviewType: "critic", summary: "Sharp." }],
    sources: { nyt: true },
    lastFetchedAt: new Date().toISOString(),
  };
  const ltPillars: BookSocialProofDTO = {
    bookId: "bk-1",
    reviewHighlights: [{ id: "lt-1", source: "librarything", reviewType: "tag", text: "Quick." }],
    sources: { libraryThing: true },
    lastFetchedAt: new Date().toISOString(),
  };
  // Warm the Hardcover cache.
  await reviewCacheRepo.upsertReviewCache({
    bookId: "bk-1",
    source: "hardcover",
    payload: SAMPLE,
  });
  // Now call with stub fetch + NYT/LT stubs. The Hardcover fetch stub
  // should NOT be called (cache hit), but NYT + LT MUST run and merge.
  const res = await handleSocialProof("bk-1", {
    fetchFn: stub,
    nytFn: async () => nytPillars,
    libraryThingFn: async () => ltPillars,
  });
  assert.equal(res.status, 200);
  assert.equal(stub.calls(), 0, "Hardcover must NOT be re-fetched on cache hit");
  const body = (await res.json()) as BookSocialProofDTO;
  assert.equal(body.sources.hardcover, true);
  assert.equal(body.sources.nyt, true, "NYT must merge on warm-cache path");
  assert.equal(body.sources.libraryThing, true, "LibraryThing must merge on warm-cache path");
  assert.equal(body.reviewHighlights.length, 2);
});

// Regression: NYT + LT are independent providers. A throw in one must
// not short-circuit the other. Promise.allSettled (over Promise.all) is
// the implementation choice — this test pins the contract.
test("NYT throwing must not prevent LibraryThing from merging", async () => {
  const stub = makeFetchStub(SAMPLE);
  const ltPillars: BookSocialProofDTO = {
    bookId: "bk-1",
    reviewHighlights: [{ id: "lt-1", source: "librarything", reviewType: "tag" }],
    sources: { libraryThing: true },
    lastFetchedAt: new Date().toISOString(),
  };
  const res = await handleSocialProof("bk-1", {
    fetchFn: stub,
    nytFn: async () => {
      throw new Error("NYT upstream blew up");
    },
    libraryThingFn: async () => ltPillars,
  });
  assert.equal(res.status, 200);
  const body = (await res.json()) as BookSocialProofDTO;
  assert.equal(body.sources.hardcover, true);
  assert.equal(body.sources.libraryThing, true, "LibraryThing must still surface");
});
