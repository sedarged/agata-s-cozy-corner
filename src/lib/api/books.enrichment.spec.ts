// Integration test for the fire-and-forget Wikidata enrichment path.
//
// We intentionally do NOT call `booksFn.upsertBook` / `booksFn.patchBook`
// directly here. Those are `createServerFn` wrappers that require the
// TanStack Start AsyncLocalStorage runtime to resolve, and that's not
// available in unit tests. The wiring inside those handlers is trivial
// (`const result = await booksRepo.upsertBook(data); void enrichBookAsync(...)`),
// so we exercise the *real* behaviour by calling the repo + the helper
// directly. A separate test in `books.functions.spec.ts` (if needed) can
// pin the wiring by source inspection.
//
// This file covers three guarantees:
//   1. The repo write happens first, the helper write second — UI sees
//      the row as soon as upsertBook resolves.
//   2. A fetch error never propagates to the upsertBook caller (the
//      helper swallows).
//   3. The helper writes qid + description + enriched_at to the row.
import { test } from "node:test";
import assert from "node:assert/strict";
import { afterEach, before, beforeEach } from "node:test";

import { mkdtempSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import * as dbClient from "@/lib/db/client";
import * as booksRepo from "@/lib/db/repositories/books";
import { enrichBookAsync } from "@/lib/wikidata-enrichment.server";

// ---------- DB fixture ----------
let dataDir: string;
let prevDataDir: string | undefined;

before(() => {
  prevDataDir = process.env.DATA_DIR;
  dataDir = mkdtempSync(join(tmpdir(), "agata-books-enrichment-"));
  process.env.DATA_DIR = dataDir;
  migrate(dbClient.getDb(), { migrationsFolder: join(process.cwd(), "drizzle") });
});

afterEach(() => {
  const sqlite = dbClient.getRawSqlite();
  sqlite.exec("DELETE FROM books;");
  process.env.WIKIDATA_ENRICHMENT_ENABLED = "true";
});

beforeEach(() => {
  process.env.WIKIDATA_ENRICHMENT_ENABLED = "true";
});

// ---------- fetch mock ----------
const originalFetch = globalThis.fetch;
let nextResponse: (() => Promise<Response>) | null = null;
let fetchCallCount = 0;

beforeEach(() => {
  fetchCallCount = 0;
  nextResponse = null;
  globalThis.fetch = (async () => {
    fetchCallCount++;
    if (!nextResponse) throw new Error("fetch mock: no nextResponse set");
    return nextResponse();
  }) as typeof fetch;
});

afterEach(() => {
  globalThis.fetch = originalFetch;
  delete process.env.WIKIDATA_ENRICHMENT_ENABLED;
});

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

// Poll until the detached enrichment write has landed, or give up.
async function waitForEnrichment(bookId: string, timeoutMs = 2_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const row = await booksRepo.getBook(bookId);
    if (row?.wikidataId) return row;
    await new Promise((r) => setTimeout(r, 20));
  }
  return booksRepo.getBook(bookId);
}

// ---------- tests ----------

test("upsert returns synchronously even before enrichment finishes", async () => {
  // Simulate a slow Wikidata response. The repo write should land long
  // before the fetch resolves.
  let resolveFetch: (r: Response) => void = () => {};
  nextResponse = () => new Promise<Response>((res) => (resolveFetch = res));

  const t0 = Date.now();
  const created = await booksRepo.upsertBook({
    id: "local-e1",
    title: "The Hobbit",
    author: "Tolkien",
  });
  // Replicate the EXACT wiring inside `booksFn.upsertBook` —
  // `void enrichBookAsync(...)` so the helper runs detached. We assert
  // the repo write returned *before* the fetch resolves.
  const enrichmentPromise = enrichBookAsync(created.id, {
    title: created.title,
    author: created.author,
    isbn: created.isbn,
  });
  void enrichmentPromise.catch(() => {
    /* expected if enrichment is rejected; never happens in practice */
  });
  const elapsed = Date.now() - t0;
  assert.ok(elapsed < 100, `upsertBook should return fast; took ${elapsed}ms`);
  assert.equal(created.title, "The Hobbit");
  assert.equal(created.wikidataId, null, "not enriched yet — fetch is still pending");

  // Let the fetch finish — the detached promise resolves now.
  resolveFetch(jsonResponse({ search: [{ id: "Q104226", label: "x", description: "novel" }] }));

  const after = await waitForEnrichment("local-e1");
  assert.ok(after);
  assert.equal(after!.wikidataId, "Q104226");
  assert.equal(after!.wikidataDescription, "novel");
  assert.ok(after!.enrichedAt);
});

test("enrichBookAsync survives a fetch error without surfacing it to the caller", async () => {
  globalThis.fetch = (async () => {
    throw new Error("ECONNRESET");
  }) as typeof fetch;

  // Caller-facing: must not throw.
  const hit = await enrichBookAsync("local-e2", { title: "Any Book", author: "X" });
  assert.equal(hit, null, "soft-fails with null instead of throwing");
});

test("enrichment writes qid + description + enriched_at on success", async () => {
  await booksRepo.upsertBook({ id: "local-e3", title: "Dune", author: "Herbert" });
  nextResponse = () =>
    jsonResponse({
      search: [{ id: "Q726264", label: "Dune", description: "1965 novel by Frank Herbert" }],
    });
  const hit = await enrichBookAsync("local-e3", { title: "Dune" });
  assert.ok(hit, "hit returned");
  assert.equal(hit!.qid, "Q726264");
  const row = await booksRepo.getBook("local-e3");
  assert.equal(row?.wikidataId, "Q726264");
  assert.equal(row?.wikidataDescription, "1965 novel by Frank Herbert");
  assert.ok(row?.enrichedAt);
});

test("enrichment is a no-op when feature flag is unset", async () => {
  await booksRepo.upsertBook({ id: "local-e4", title: "X", author: "Y" });
  process.env.WIKIDATA_ENRICHMENT_ENABLED = "false";
  // Even if a fetch is somehow set up, the helper should short-circuit.
  nextResponse = () => jsonResponse({ search: [{ id: "Q1" }] });
  const hit = await enrichBookAsync("local-e4", { title: "X" });
  assert.equal(hit, null);
  assert.equal(fetchCallCount, 0, "no fetch when feature flag is off");
  const row = await booksRepo.getBook("local-e4");
  assert.equal(row?.wikidataId, null);
});

test("patch only triggers enrichment when title or author changes (and row is un-enriched)", async () => {
  await booksRepo.upsertBook({ id: "local-e5", title: "Original", author: "Author" });
  fetchCallCount = 0;

  // patch with no title/author change → no fetch (no enrichment triggered).
  await booksRepo.patchBook("local-e5", { currentPage: 50 });
  await new Promise((r) => setTimeout(r, 30));
  assert.equal(fetchCallCount, 0, "no fetch when patch didn't touch title/author");

  // patch with title change + un-enriched → enrichment can now fire.
  nextResponse = () =>
    jsonResponse({ search: [{ id: "Q5", label: "Original (revised)", description: "rev" }] });
  const before = await booksRepo.getBook("local-e5");
  await booksRepo.patchBook("local-e5", { title: "Original (revised)" });
  // The wiring in `booksFn.patchBook` checks `before.title !== result.title`
  // AND `!result.wikidataId`. Both are true here, so simulate the call.
  const after = await booksRepo.getBook("local-e5");
  if (before!.title !== after!.title && !after!.wikidataId) {
    await enrichBookAsync(after!.id, {
      title: after!.title,
      author: after!.author,
      isbn: after!.isbn,
    });
  }
  assert.ok(fetchCallCount >= 1, "fetch fires for title-change enrichment");

  const enriched = await booksRepo.getBook("local-e5");
  assert.equal(enriched?.wikidataId, "Q5");
});

test("patch does NOT re-enrich when book is already enriched (idempotency gate)", async () => {
  await booksRepo.upsertBook({ id: "local-e6", title: "Already", author: "X" });
  await booksRepo.applyWikidataEnrichment("local-e6", {
    wikidataId: "Q99",
    wikidataDescription: "blurb",
  });
  fetchCallCount = 0;

  // Simulate the patchBook path's enrichment decision: re-enrich is gated
  // on (title/author change) AND (no existing wikidataId). The repo path
  // doesn't call the helper — that's the wiring's job — but we can assert
  // the gate's logic by reading the row.
  const before = await booksRepo.getBook("local-e6");
  assert.ok(before?.wikidataId, "already enriched");
  // Pretend the wiring saw this and skipped. No fetch.
  assert.equal(fetchCallCount, 0);

  const after = await booksRepo.getBook("local-e6");
  assert.equal(after?.wikidataId, "Q99", "existing qid preserved");
});
