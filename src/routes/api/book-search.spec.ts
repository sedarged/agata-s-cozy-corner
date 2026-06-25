// M15: enrichSchema must reject unknown keys (drop .passthrough()).
//
// The enrich endpoint accepts a previously-returned BookSearchResult and
// asks the server to fetch richer metadata. The old `.passthrough()` let
// arbitrary extra fields through — a hostile client could inject `evil:
// "stuff"` and have the server silently store it (it ended up in the
// paginated items the user rendered as a link / cover / etc.). Pin the
// contract with these tests.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { z } from "zod";

const here = dirname(fileURLToPath(import.meta.url));
const source = readFileSync(resolve(here, "book-search.ts"), "utf8");

// Doc-style pin: the route file must NOT use .passthrough() in enrichSchema.
// Project convention — see notes-filter-overflow.spec.tsx, openai-key save
// spec, etc. Catches a "let me add it back for forward-compat" drift.
test("route source does not use .passthrough() on enrichSchema (M15)", () => {
  // Strip line-comments and block-comments before scanning so the doc-pin
  // isn't fooled by the explanatory "No .passthrough()" comment we wrote.
  const stripped = source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
  assert.ok(
    !/\.passthrough\s*\(\s*\)/.test(stripped),
    "enrichSchema must not be .passthrough() — pin the strict wire format",
  );
});

// Behavioural pin: mirror the route's schema here (so the spec exercises
// the actual field shape too) and assert extra keys are rejected.
const enrichSchema = z
  .object({
    result: z
      .object({
        source: z.enum(["openlibrary", "google", "bn"]),
        external_id: z.string(),
        title: z.string(),
        author: z.string(),
        isbn: z.string().optional(),
      })
      .strict(),
  })
  .strict();

test("accepts a minimal valid payload", () => {
  const r = enrichSchema.safeParse({
    result: { source: "openlibrary", external_id: "/works/OL1W", title: "Foo", author: "Bar" },
  });
  assert.equal(r.success, true);
});

test("accepts a payload with the optional isbn field", () => {
  const r = enrichSchema.safeParse({
    result: {
      source: "google",
      external_id: "abc",
      title: "Foo",
      author: "Bar",
      isbn: "9788375780630",
    },
  });
  assert.equal(r.success, true);
});

test("rejects an unknown top-level key (M15)", () => {
  const r = enrichSchema.safeParse({
    result: { source: "openlibrary", external_id: "/works/OL1W", title: "Foo", author: "Bar" },
    evil: "stuff",
  });
  assert.equal(r.success, false);
});

test("rejects unknown keys inside result (M15)", () => {
  const r = enrichSchema.safeParse({
    result: {
      source: "openlibrary",
      external_id: "/works/OL1W",
      title: "Foo",
      author: "Bar",
      evilField: "tampered",
    },
  });
  assert.equal(r.success, false);
});

test("rejects invalid source enum", () => {
  const r = enrichSchema.safeParse({
    result: { source: "evil", external_id: "x", title: "Foo", author: "Bar" },
  });
  assert.equal(r.success, false);
});

test("rejects missing required field", () => {
  const r = enrichSchema.safeParse({
    result: { source: "openlibrary", external_id: "x", title: "Foo" }, // missing author
  });
  assert.equal(r.success, false);
});
