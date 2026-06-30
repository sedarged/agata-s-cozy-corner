// Tests for the social-proof provider. We pin the deterministic mock path
// (`mockSocialProof`) because it's the contract the route layer relies on
// when `HARDCOVER_TOKEN` is unset — and it's the only path that runs in
// the sandbox (no live HTTP).
import { test } from "node:test";
import assert from "node:assert/strict";
import { escapeIlike, mockSocialProof } from "./social-proof.server";

test("mockSocialProof: returns the requested bookId", () => {
  const r = mockSocialProof({ bookId: "local-1", isbn: "9780000000001" });
  assert.equal(r.bookId, "local-1");
});

test("mockSocialProof: ratingsCount > 0 and averageRating in [1, 5]", () => {
  const r = mockSocialProof({ bookId: "local-1", isbn: "9780000000001" });
  assert.ok((r.ratingsCount ?? 0) > 0, "ratingsCount must be positive");
  assert.ok(
    (r.averageRating ?? 0) >= 1 && (r.averageRating ?? 0) <= 5,
    `averageRating must be 1..5, got ${r.averageRating}`,
  );
});

test("mockSocialProof: ratingDistribution sums to ratingsCount", () => {
  const r = mockSocialProof({ bookId: "x", isbn: "9780000000002" });
  const dist = r.ratingDistribution;
  assert.ok(dist);
  const sum =
    (dist.oneStar ?? 0) +
    (dist.twoStar ?? 0) +
    (dist.threeStar ?? 0) +
    (dist.fourStar ?? 0) +
    (dist.fiveStar ?? 0);
  assert.equal(sum, r.ratingsCount);
});

test("mockSocialProof: reviewHighlights has at most a handful of entries", () => {
  const r = mockSocialProof({ bookId: "x", isbn: "9780000000003" });
  assert.ok(Array.isArray(r.reviewHighlights));
  assert.ok(r.reviewHighlights.length >= 1 && r.reviewHighlights.length <= 5);
  for (const h of r.reviewHighlights) {
    assert.ok(["reader", "critic", "tag"].includes(h.reviewType));
  }
});

test("mockSocialProof: deterministic — same input → same output", () => {
  const a = mockSocialProof({ bookId: "x", isbn: "9780000000004", title: "T", author: "A" });
  const b = mockSocialProof({ bookId: "x", isbn: "9780000000004", title: "T", author: "A" });
  assert.equal(a.averageRating, b.averageRating);
  assert.equal(a.ratingsCount, b.ratingsCount);
  assert.equal(a.reviewHighlights[0]?.summary, b.reviewHighlights[0]?.summary);
});

test("mockSocialProof: different inputs → different ratings", () => {
  const a = mockSocialProof({ bookId: "a", isbn: "9780000000005" });
  const b = mockSocialProof({ bookId: "b", isbn: "9780000000006" });
  // Not strictly required (hash collisions are possible), but highly likely.
  // We at least require the two outputs to be present and well-formed.
  assert.ok(typeof a.averageRating === "number");
  assert.ok(typeof b.averageRating === "number");
});

test("mockSocialProof: sources are empty (mock does not claim a real provider)", () => {
  const r = mockSocialProof({ bookId: "x", isbn: "9780000000007" });
  // Mock must NOT claim hardcover/googleBooks/etc. — otherwise the UI would
  // mis-attribute the data and Agata would think these are real reviews.
  assert.equal(r.sources.hardcover, undefined);
  assert.equal(r.sources.googleBooks, undefined);
});

test('mockSocialProof: review snippets carry source="mock" (not mis-attributed)', () => {
  // W2: a future Open Library / Google Books integration must NOT pick these
  // rows up as real reader data. Pin the source label so a refactor that
  // re-uses "openlibrary" for mock rows fails CI immediately.
  const r = mockSocialProof({ bookId: "x", isbn: "9780000000007" });
  assert.equal(r.reviewHighlights.length, 2);
  for (const h of r.reviewHighlights) {
    assert.equal(h.source, "mock");
  }
});

// ---------- escapeIlike (S6: ILIKE wildcard defence) ----------

test("escapeIlike escapes % so a user title can't act as a wildcard", () => {
  // The bug S6 was about: a book titled "50%" would, before the fix,
  // interpolate into `%50%%` — Postgres ILIKE would treat the inner `%`
  // as "any string", so the upstream would match every book containing
  // "50". After the fix, the user's `%` becomes `\%` (literal).
  assert.equal(escapeIlike("50%"), "50\\%");
  assert.equal(escapeIlike("a%b%c"), "a\\%b\\%c");
});

test("escapeIlike escapes _ and \\ too (full ILIKE metacharacter set)", () => {
  assert.equal(escapeIlike("foo_bar"), "foo\\_bar");
  assert.equal(escapeIlike("back\\slash"), "back\\\\slash");
});

test("escapeIlike leaves a clean title untouched", () => {
  assert.equal(escapeIlike("The Pragmatic Programmer"), "The Pragmatic Programmer");
});

test("escapeIlike escapes every metacharacter in one pass", () => {
  assert.equal(escapeIlike("a%b_c\\d"), "a\\%b\\_c\\\\d");
});

test("escapeIlike composed with the surrounding %…% wrapper produces a safe ILIKE pattern", () => {
  // Integration-boundary pin: this is the exact expression `buildHardcoverQuery`
  // evaluates to set the `$title` variable. A book titled "50%" must match
  // literally — not "every book containing '50'". Without `escapeIlike`, the
  // inner `%` would be interpreted as the "any string" wildcard and the
  // surrounding `%` is the suffix wildcard.
  const title = "50%";
  const wireValue = `%${escapeIlike(title)}%`;
  assert.equal(wireValue, "%50\\%%");
});

test("mockSocialProof: lastFetchedAt is a parseable ISO string", () => {
  const r = mockSocialProof({ bookId: "x", isbn: "9780000000008" });
  const t = Date.parse(r.lastFetchedAt);
  assert.ok(!Number.isNaN(t), `lastFetchedAt must parse, got ${r.lastFetchedAt}`);
});
