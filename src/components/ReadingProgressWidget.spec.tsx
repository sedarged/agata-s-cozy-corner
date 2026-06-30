// Tests for the ReadingProgressWidget component. The widget is a thin shell
// over `computeReadingProgress` and `formatEta`; the spec pins the
// formatter's four outputs (the only behaviour the JSX adds on top of the
// pure helper). The progress math itself is pinned in
// `reading-progress.spec.ts`.
import { test } from "node:test";
import assert from "node:assert/strict";
import { formatEta, computeReadingProgress, pagesLabel } from "@/lib/reading-progress";

test("formatEta: minutes-only when estHours === 0", () => {
  assert.equal(formatEta(45, 0, 45), "45 min");
});

test("formatEta: full hours when no remainder", () => {
  assert.equal(formatEta(120, 2, 0), "2 g");
});

test("formatEta: hours + remainder", () => {
  assert.equal(formatEta(135, 2, 15), "2 g 15 min");
});

test("formatEta: em-dash when estMinutes <= 0", () => {
  assert.equal(formatEta(0, 0, 0), "—");
});

// Logic-level contracts that the widget branches on. The JSX uses these
// flags to render the empty / finished / "few sessions" states; pinning them
// here keeps the names visible from the test surface.
test("widget branch: empty state when pageCount missing", () => {
  const r = computeReadingProgress({ pageCount: 0, currentPage: 50, sessions: [] });
  assert.equal(r.percent, 0);
  assert.equal(r.pagesLeft, 0);
});

test("widget branch: finished state when percent >= 100", () => {
  const r = computeReadingProgress({
    pageCount: 200,
    currentPage: 200,
    sessions: [{ date: "2026-06-30", minutes: 30, pagesRead: 60 }],
  });
  assert.equal(r.percent, 100);
});

test("widget branch: 'few sessions' hint fires when hasEnoughHistory === false", () => {
  const r = computeReadingProgress({
    pageCount: 200,
    currentPage: 50,
    sessions: [{ date: "2026-06-30", minutes: 10, pagesRead: 4 }],
  });
  assert.equal(r.hasEnoughHistory, false);
});

test("widget branch: 'few sessions' hint suppressed when hasEnoughHistory === true", () => {
  const r = computeReadingProgress({
    pageCount: 200,
    currentPage: 80,
    sessions: [{ date: "2026-06-30", minutes: 30, pagesRead: 60 }],
  });
  assert.equal(r.hasEnoughHistory, true);
});

// Polish plural form for "strona" / "strony" / "stron". Pinned because the
// widget reads this on every render; a regression here would produce
// "1 strony" or "22 strona".
test("pagesLabel: singular for 1", () => {
  assert.equal(pagesLabel(1), "strona");
});
test("pagesLabel: few-form for 2..4", () => {
  assert.equal(pagesLabel(2), "strony");
  assert.equal(pagesLabel(3), "strony");
  assert.equal(pagesLabel(4), "strony");
});
test("pagesLabel: many-form for 5..21", () => {
  assert.equal(pagesLabel(5), "stron");
  assert.equal(pagesLabel(21), "stron");
});
test("pagesLabel: teen/tyysiąc-many-form for 12..14 (override last digit)", () => {
  assert.equal(pagesLabel(12), "stron");
  assert.equal(pagesLabel(13), "stron");
  assert.equal(pagesLabel(14), "stron");
});
test("pagesLabel: 22..24 are few-form again (after teens)", () => {
  assert.equal(pagesLabel(22), "strony");
  assert.equal(pagesLabel(23), "strony");
  assert.equal(pagesLabel(24), "strony");
});
test("pagesLabel: 0 and big numbers are many-form", () => {
  assert.equal(pagesLabel(0), "stron");
  assert.equal(pagesLabel(100), "stron");
  assert.equal(pagesLabel(320), "stron");
});
