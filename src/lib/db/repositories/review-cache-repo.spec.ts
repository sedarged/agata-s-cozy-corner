// Agata — review_cache repo spec.
//
// Round-trip + boundary tests for the social-proof cache repo. The
// repo sits between the route layer and the SQLite table; any future
// rewrite that drops `ON CONFLICT` upsert semantics, breaks FK
// cascade, or fails to refresh `fetched_at` will fail these tests
// loudly.
//
// Uses the same single-DB-per-file pattern as `db.test.ts` —
// migrations are applied once in `before`, then rows are wiped between
// tests in `beforeEach`.
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import * as dbClient from "@/lib/db/client";
import * as booksRepo from "./books";
import * as reviewCacheRepo from "./review-cache-repo";

let dataDir: string;
let prevDataDir: string | undefined;

test.before(() => {
  prevDataDir = process.env.DATA_DIR;
  dataDir = mkdtempSync(join(tmpdir(), "agata-rvcache-"));
  process.env.DATA_DIR = dataDir;
  migrate(dbClient.getDb(), { migrationsFolder: join(process.cwd(), "drizzle") });
});

test.after(() => {
  dbClient.closeDb();
  process.env.DATA_DIR = prevDataDir;
  if (existsSync(dataDir)) rmSync(dataDir, { recursive: true, force: true });
});

test.beforeEach(() => {
  // Wipe the two new tables between tests so they're hermetic.
  dbClient.getRawSqlite().exec("DELETE FROM review_cache;");
  dbClient.getRawSqlite().exec("DELETE FROM books;");
  booksRepo.upsertBook({
    id: "bk-cache-1",
    title: "Cache Test Book",
    author: "Author",
  });
});

test("upsertReviewCache persists payload and stamps fetched_at", async () => {
  const r = await reviewCacheRepo.upsertReviewCache({
    bookId: "bk-cache-1",
    source: "hardcover",
    payload: { mock: true },
  });
  assert.ok(r);
  assert.ok(r.fetchedAt);
});

test("getReviewCache returns the cached row by (bookId, source)", async () => {
  await reviewCacheRepo.upsertReviewCache({
    bookId: "bk-cache-1",
    source: "hardcover",
    payload: { ratingsCount: 42 },
  });
  const row = await reviewCacheRepo.getReviewCache({
    bookId: "bk-cache-1",
    source: "hardcover",
  });
  assert.ok(row);
  assert.deepEqual(JSON.parse(row.payload), { ratingsCount: 42 });
});

test("upsertReviewCache ON CONFLICT replaces payload and refreshes fetched_at", async () => {
  await reviewCacheRepo.upsertReviewCache({
    bookId: "bk-cache-1",
    source: "hardcover",
    payload: { v: 1 },
  });
  const first = await reviewCacheRepo.getReviewCache({
    bookId: "bk-cache-1",
    source: "hardcover",
  });
  // Wait so the second timestamp is strictly greater
  await new Promise((r) => setTimeout(r, 5));
  await reviewCacheRepo.upsertReviewCache({
    bookId: "bk-cache-1",
    source: "hardcover",
    payload: { v: 2 },
  });
  const second = await reviewCacheRepo.getReviewCache({
    bookId: "bk-cache-1",
    source: "hardcover",
  });
  assert.ok(first && second);
  assert.deepEqual(JSON.parse(second.payload), { v: 2 });
  assert.notEqual(first.fetchedAt, second.fetchedAt);
});

test("getReviewCache returns undefined when the row is missing", async () => {
  const row = await reviewCacheRepo.getReviewCache({
    bookId: "bk-cache-1",
    source: "nyt-unconfigured",
  });
  assert.equal(row, undefined);
});

test("deleting a book cascades its cached rows", async () => {
  await reviewCacheRepo.upsertReviewCache({
    bookId: "bk-cache-1",
    source: "hardcover",
    payload: { v: 1 },
  });
  await booksRepo.deleteBook("bk-cache-1");
  const row = await reviewCacheRepo.getReviewCache({
    bookId: "bk-cache-1",
    source: "hardcover",
  });
  assert.equal(row, undefined);
});
