// book-search-batch.spec.ts — TDD for the batch ISBN helpers
// (splitIsbns, BATCH_MAX). The HTTP route lives in
// `src/routes/api/book-search.batch.ts` and is exercised in e2e.

import { test } from "node:test";
import assert from "node:assert/strict";
import { splitIsbns, BATCH_MAX, type BatchInput } from "./book-search-batch";

test("splitIsbns: separates valid and invalid entries, preserving order", () => {
  const out = splitIsbns(["9780201616224", "nope", "123", "978-0-306-40615-7", ""] as BatchInput);
  assert.deepEqual(out.valid, [
    "9780201616224",
    "9780306406157", // ISBN-10 → 13 conversion happens elsewhere; this stays 10 here
  ]);
  // Empty string and "nope" are invalid; "123" is too short.
  assert.equal(out.valid.length, 2);
  assert.equal(out.invalid.length, 3);
});

test("splitIsbns: deduplicates identical ISBNs and accepts the X ISBN-10 check digit", () => {
  // 9780201616224 dedupes to 1; 155404295X and 155404295x differ only in
  // case and are kept as separate entries (we canonicalise X→X on the
  // way out, but dedup uses the exact cleaned form to avoid colliding
  // 10- and 13-digit ISBNs that share digits).
  const out = splitIsbns(["9780201616224", "9780201616224", "155404295X", "155404295x"]);
  assert.deepEqual(out.valid, ["9780201616224", "155404295X", "155404295X"]);
  assert.equal(out.invalid.length, 0);
});

test("splitIsbns: rejects more than BATCH_MAX ISBNs (caller must chunk)", () => {
  const tooMany = Array.from({ length: BATCH_MAX + 1 }, (_, i) => `978020161622${i % 10}`);
  const out = splitIsbns(tooMany);
  assert.equal(out.tooMany, true);
  assert.equal(out.valid.length, 0);
});

test("splitIsbns: trims whitespace and accepts both ISBN-10 and ISBN-13 forms", () => {
  const out = splitIsbns(["  9780201616224  ", " 155404295X "]);
  assert.equal(out.valid.length, 2);
});

test("splitIsbns: rejects 13 non-digit characters in ISBN-13", () => {
  // 13 X's — the strip step leaves 13 X's (length 13, passes length
  // guard) but the digit-only ISBN-13 regex rejects them. The length-13
  // branch is the only thing catching this; the length-10 branch is
  // tautological after the strip and is intentionally absent.
  const out = splitIsbns(["XXXXXXXXXXXXX"]);
  assert.equal(out.valid.length, 0);
  assert.equal(out.invalid.length, 1);
  assert.equal(out.invalid[0]?.reason, "bad ISBN-13 format");
});
