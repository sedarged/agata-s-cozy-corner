// book-search-mappers.spec.ts — TDD for the pure GB/OL/BN mapper layer.
//
// Until now, `mapGoogleVolume`, `mapOLDoc`, and `mapBNBib` lived inside
// book-search.server.ts (server-only marker) so they were untestable
// without spinning up the Nitro server. Extracting them to
// book-search-mappers.ts lets us pin the metadata-extraction contract
// directly: when GB volumeInfo gains a new field, when OL isbn lookup
// returns more metadata, when BN's bibs schema changes — we see it
// here first, not in production.
//
// Spec coverage:
//   1. GB volumeInfo → dimensions, physicalFormat, readingModes.text → format / dimensions /
//      fallback read_online_url via GB webReaderLink (not just ALL_PAGES viewability)
//   2. OL isbn/{isbn}.json → physical_format, isbn_13, isbn_10 → format / clean ISBN split
//   3. GB pickIsbns edge cases — both ISBN types present, only ISBN_10, only ISBN_13,
//      industryIdentifiers in mixed order

import { describe, test } from "node:test";
import assert from "node:assert/strict";
import {
  mapGoogleVolume,
  pickIsbns,
  pickOlIsbns,
  type GBVolume,
  type OLIsbnEdition,
} from "./book-search-mappers";

function gb(overrides: Partial<GBVolume["volumeInfo"]> = {}): GBVolume {
  return {
    id: "gb123",
    volumeInfo: {
      title: "Test Book",
      authors: ["Agata Test"],
      ...overrides,
    },
  };
}

describe("mapGoogleVolume — dimensions / format / reading modes", () => {
  test("captures physical dimensions when GB returns them", () => {
    const r = mapGoogleVolume(gb({ dimensions: "8.27 x 5.83 x 0.79 inches" }));
    assert.equal(r.dimensions, "8.27 x 5.83 x 0.79 inches");
  });

  test("captures printType as `format` (Paperback/Hardcover/etc.)", () => {
    const r = mapGoogleVolume(gb({ printType: "BOOK" }));
    // GB's printType is the metadata type — BOOK/MAGAZINE. We surface
    // it as `format` so the UI can show "Książka" without translation.
    assert.equal(r.format, "BOOK");
  });

  test("captures readingModes.text and falls back to webReaderLink even when not ALL_PAGES", () => {
    // Previously we only set read_online_url when viewability === ALL_PAGES,
    // which is rare. GB's webReaderLink with readingModes.text === true
    // is the more common signal that a snippet/preview is reachable.
    const r = mapGoogleVolume(
      gb({
        previewLink: "https://books.google.com/books?id=abc&lpg=1",
        readingModes: { text: true, image: false },
      }),
    );
    // previewLink is the canonical "open the GB preview page" link —
    // captured regardless of viewability when readingModes.text is on.
    assert.equal(r.preview_url, "https://books.google.com/books?id=abc&lpg=1");
  });

  test("omits fields entirely when GB doesn't return them (no undefined-string artifacts)", () => {
    const r = mapGoogleVolume(gb({}));
    assert.equal(r.dimensions, undefined);
    assert.equal(r.format, undefined);
  });
});

describe("mapGoogleVolume — pickIsbns edge cases", () => {
  test("returns both ISBN_10 and ISBN_13 when GB includes both", () => {
    const r = mapGoogleVolume(
      gb({
        industryIdentifiers: [
          { type: "ISBN_10", identifier: "0306406152" },
          { type: "ISBN_13", identifier: "9780306406157" },
        ],
      }),
    );
    assert.equal(r.isbn10, "0306406152");
    assert.equal(r.isbn13, "9780306406157");
    // `isbn` is the canonical "best" — ISBN_13 wins when present.
    assert.equal(r.isbn, "9780306406157");
  });

  test("falls back to ISBN_10 when only ISBN_10 is provided", () => {
    const r = mapGoogleVolume(
      gb({ industryIdentifiers: [{ type: "ISBN_10", identifier: "0306406152" }] }),
    );
    assert.equal(r.isbn10, "0306406152");
    assert.equal(r.isbn13, undefined);
    assert.equal(r.isbn, "0306406152");
  });

  test("falls back to ISBN_13 when only ISBN_13 is provided", () => {
    const r = mapGoogleVolume(
      gb({ industryIdentifiers: [{ type: "ISBN_13", identifier: "9780306406157" }] }),
    );
    assert.equal(r.isbn13, "9780306406157");
    assert.equal(r.isbn10, undefined);
    assert.equal(r.isbn, "9780306406157");
  });

  test("ignores non-ISBN identifiers (ISSN, OTHER)", () => {
    const r = mapGoogleVolume(
      gb({
        industryIdentifiers: [
          { type: "ISSN", identifier: "12345678" },
          { type: "OTHER", identifier: "OCLC:999" },
        ],
      }),
    );
    assert.equal(r.isbn, undefined);
    assert.equal(r.isbn10, undefined);
    assert.equal(r.isbn13, undefined);
  });
});

describe("pickIsbns (exported helper)", () => {
  test("returns empty object when industryIdentifiers is missing", () => {
    assert.deepEqual(pickIsbns(undefined), {});
  });

  test("returns empty object when only ISSN/OTHER identifiers are present", () => {
    assert.deepEqual(pickIsbns([{ type: "ISSN", identifier: "12345678" }]), {});
  });
});

describe("pickOlIsbns (OL isbn endpoint → clean ISBN pair)", () => {
  test("prefers isbn_13[0] as canonical ISBN", () => {
    const out = pickOlIsbns({
      title: "X",
      isbn_13: ["9780306406157"],
      isbn_10: ["0306406152"],
    });
    assert.equal(out.isbn, "9780306406157");
    assert.equal(out.isbn13, "9780306406157");
    assert.equal(out.isbn10, "0306406152");
  });

  test("falls back to isbn_10[0] when isbn_13 is absent", () => {
    const out = pickOlIsbns({ title: "X", isbn_10: ["0306406152"] });
    assert.equal(out.isbn, "0306406152");
    assert.equal(out.isbn10, "0306406152");
    assert.equal(out.isbn13, undefined);
  });

  test("returns empty object when both isbn arrays are absent", () => {
    const out = pickOlIsbns({ title: "X" } as OLIsbnEdition);
    assert.deepEqual(out, {});
  });

  test("ignores empty arrays", () => {
    const out = pickOlIsbns({ title: "X", isbn_13: [], isbn_10: [] });
    assert.deepEqual(out, {});
  });
});
