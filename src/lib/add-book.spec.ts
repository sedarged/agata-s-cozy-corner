// Agata — regression tests for the add-book "duplicate detection +
// override" decision. The user-visible flow is:
//
//   1. User searches for a book on /add-book.
//   2. Click "Zobacz szczegóły i dodaj" → ResultCard opens.
//   3. Click "Dodaj do biblioteki":
//      - if the book is already in the library, ResultCard swaps to the
//        duplicate UI ("Ta książka jest już w bibliotece" + "Otwórz
//        książkę" + "Dodaj mimo to" + "Anuluj") WITHOUT calling the
//        upsertBook server function.
//      - otherwise upsertBook runs and the user is routed to /book/:id.
//   4. Click "Dodaj mimo to" → upsertBook runs with a fresh id (so the
//      DB ends up with two books sharing the same isbn/title/author).
//
// These tests pin both halves of that contract at the pure-decision layer
// (`decideAddAction`) so a future refactor of add-book.tsx cannot silently
// regress the "Dodaj mimo to" path or the duplicate-guard.
//
// The helper itself is intentionally framework-free — no React, no React
// Query, no router — so it can be exercised under node:test without
// booting TanStack Start's async-local-storage.

import { describe, test } from "node:test";
import assert from "node:assert/strict";

import {
  buildIsbnIndex,
  buildTitleAuthorIndex,
  findDuplicate,
  decideAddAction,
  type DupIndex,
} from "@/lib/add-book";

describe("add-book duplicate detection", () => {
  const seed = [
    {
      id: "seed-1",
      title: "Pan Tadeusz",
      author: "Adam Mickiewicz",
      isbn: "9788373271920",
    },
  ];
  const isbnIndex = buildIsbnIndex(seed);
  const titleIndex = buildTitleAuthorIndex(seed);
  const index: DupIndex = { isbn: isbnIndex, titleAuthor: titleIndex };

  test("matches by cleaned isbn", () => {
    const hit = findDuplicate(index, {
      isbn: "978-83-7327-192-0",
      title: "Anything",
      author: "Anyone",
    });
    assert.equal(hit?.id, "seed-1");
  });

  test("matches by normalised title + author when isbn absent", () => {
    const hit = findDuplicate(index, {
      title: "  PAN  TADEUSZ  ",
      author: "adam    Mickiewicz",
    });
    assert.equal(hit?.id, "seed-1");
  });

  // Pins the diacritic-strip path of normDup: Polish precomposed
  // letters (ł, ą, ć, ę, ń, ó, ś, ź, ż) don't decompose to a Latin
  // base via NFKD — `ł` in particular has no decomposition at all.
  // Both directions need to match: a seed stored as "Boleslaw Prus"
  // (user-typed) must collide with an API result of "Bolesław Prus",
  // AND vice versa (seed stored as "Bolesław Prus" must match a
  // search query of "Boleslaw Prus").
  test("matches across Polish diacritics (both directions)", () => {
    const seedAscii = [{ id: "seed-ascii", title: "Lalka", author: "Boleslaw Prus", isbn: "" }];
    const indexAscii: DupIndex = {
      isbn: buildIsbnIndex(seedAscii),
      titleAuthor: buildTitleAuthorIndex(seedAscii),
    };
    assert.equal(
      findDuplicate(indexAscii, { title: "lalka", author: "Bolesław Prus" })?.id,
      "seed-ascii",
    );

    const seedPolish = [{ id: "seed-polish", title: "Lalka", author: "Bolesław Prus", isbn: "" }];
    const indexPolish: DupIndex = {
      isbn: buildIsbnIndex(seedPolish),
      titleAuthor: buildTitleAuthorIndex(seedPolish),
    };
    assert.equal(
      findDuplicate(indexPolish, { title: "lalka", author: "Boleslaw Prus" })?.id,
      "seed-polish",
    );
  });

  test("does NOT match when author differs even if title matches", () => {
    const hit = findDuplicate(index, {
      title: "Pan Tadeusz",
      author: "Different Author",
    });
    assert.equal(hit, undefined);
  });

  test("does NOT match when only one of title/author is supplied", () => {
    const hit = findDuplicate(index, { title: "Pan Tadeusz" });
    assert.equal(hit, undefined);
  });
});

describe("add-book decideAddAction", () => {
  const seed = [
    {
      id: "seed-1",
      title: "Pan Tadeusz",
      author: "Adam Mickiewicz",
      isbn: "9788373271920",
    },
  ];
  const index: DupIndex = {
    isbn: buildIsbnIndex(seed),
    titleAuthor: buildTitleAuthorIndex(seed),
  };

  const incoming = {
    title: "Pan Tadeusz",
    author: "Adam Mickiewicz",
    isbn: "9788373271920",
  };

  test("non-duplicate → proceed with the input that will be persisted", () => {
    const decision = decideAddAction({
      force: false,
      data: { ...incoming, title: "Lalka", author: "Bolesław Prus", isbn: "" },
      index,
      input: { id: "b-new", title: "Lalka", author: "Bolesław Prus" },
    });
    assert.equal(decision.kind, "proceed");
    if (decision.kind === "proceed") {
      assert.equal(decision.input.id, "b-new");
    }
  });

  test("isbn-duplicate → duplicate result, input is NOT consumed", () => {
    const decision = decideAddAction({
      force: false,
      data: incoming,
      index,
      input: { id: "b-new", title: "Pan Tadeusz" },
    });
    assert.equal(decision.kind, "duplicate");
    if (decision.kind === "duplicate") {
      assert.equal(decision.book.id, "seed-1");
    }
  });

  test("title+author duplicate (no isbn) → duplicate result", () => {
    const decision = decideAddAction({
      force: false,
      data: { title: "Pan Tadeusz", author: "Adam Mickiewicz", isbn: "" },
      index,
      input: { id: "b-new", title: "Pan Tadeusz" },
    });
    assert.equal(decision.kind, "duplicate");
    if (decision.kind === "duplicate") {
      assert.equal(decision.book.id, "seed-1");
    }
  });

  test("force=true bypasses the duplicate guard and proceeds", () => {
    const decision = decideAddAction({
      force: true,
      data: incoming,
      index,
      input: { id: "b-override", title: "Pan Tadeusz" },
    });
    assert.equal(decision.kind, "proceed");
    if (decision.kind === "proceed") {
      // The new id must survive the bypass — that's what makes "Dodaj
      // mimo to" actually create a SECOND book in the library rather
      // than no-op'ing or upserting over the seed.
      assert.equal(decision.input.id, "b-override");
    }
  });
});
