// Tests for the pure reading-progress helper. node:test (project standard).
import { test } from "node:test";
import assert from "node:assert/strict";
import { computeReadingProgress } from "./reading-progress";

test("pagesLeft = pageCount - currentPage", () => {
  const r = computeReadingProgress({
    pageCount: 300,
    currentPage: 120,
    sessions: [],
  });
  assert.equal(r.pagesLeft, 180);
});

test("percent = round(currentPage / pageCount * 100), clamped 0..100", () => {
  const r = computeReadingProgress({ pageCount: 300, currentPage: 120, sessions: [] });
  assert.equal(r.percent, 40);
});

test("percent clamps to 100 when currentPage > pageCount (data drift)", () => {
  const r = computeReadingProgress({ pageCount: 200, currentPage: 250, sessions: [] });
  assert.equal(r.percent, 100);
});

test("percent = 0 when currentPage is 0 (reader hasn't started)", () => {
  const r = computeReadingProgress({ pageCount: 300, currentPage: 0, sessions: [] });
  assert.equal(r.percent, 0);
});

test("percent = 0 and pagesLeft = 0 when pageCount is missing", () => {
  const r = computeReadingProgress({ pageCount: 0, currentPage: 50, sessions: [] });
  assert.equal(r.percent, 0);
  assert.equal(r.pagesLeft, 0);
});

test("estMinutes falls back to defaultPagesPerHour when no sessions", () => {
  // 30 pph → 2 min/page. 100 pages left → 200 minutes.
  const r = computeReadingProgress({ pageCount: 200, currentPage: 100, sessions: [] });
  assert.equal(r.estMinutes, 200);
  assert.equal(r.estHours, 3);
  assert.equal(r.estRemainingMinutes, 20);
  assert.equal(r.hasEnoughHistory, false);
  assert.equal(r.avgPagesPerMinute, 0.5);
});

test("hasEnoughHistory === false when total session pages < 5", () => {
  const r = computeReadingProgress({
    pageCount: 200,
    currentPage: 50,
    sessions: [{ date: "2026-06-30", minutes: 10, pagesRead: 4 }],
  });
  assert.equal(r.hasEnoughHistory, false);
});

test("hasEnoughHistory === true when total session pages >= 5", () => {
  const r = computeReadingProgress({
    pageCount: 200,
    currentPage: 50,
    sessions: [{ date: "2026-06-30", minutes: 10, pagesRead: 5 }],
  });
  assert.equal(r.hasEnoughHistory, true);
});

test("uses real rate when hasEnoughHistory", () => {
  // 60 pages in 30 minutes = 2 p/m. 120 pages left → 60 minutes.
  const r = computeReadingProgress({
    pageCount: 200,
    currentPage: 80,
    sessions: [{ date: "2026-06-30", minutes: 30, pagesRead: 60 }],
  });
  assert.equal(r.avgPagesPerMinute, 2);
  assert.equal(r.estMinutes, 60);
  assert.equal(r.estHours, 1);
  assert.equal(r.estRemainingMinutes, 0);
  assert.equal(r.hasEnoughHistory, true);
});

test("estMinutes = 0 when book is finished (pagesLeft = 0)", () => {
  const r = computeReadingProgress({
    pageCount: 200,
    currentPage: 200,
    sessions: [{ date: "2026-06-30", minutes: 30, pagesRead: 60 }],
  });
  assert.equal(r.pagesLeft, 0);
  assert.equal(r.estMinutes, 0);
  assert.equal(r.estHours, 0);
});

test("custom defaultPagesPerHour and historyPagesThreshold", () => {
  const r = computeReadingProgress({
    pageCount: 100,
    currentPage: 50,
    sessions: [{ date: "2026-06-30", minutes: 5, pagesRead: 2 }],
    defaultPagesPerHour: 60, // 1 min/page
    historyPagesThreshold: 10,
  });
  // 50 pages left, 1 min/page → 50 min.
  assert.equal(r.estMinutes, 50);
  assert.equal(r.hasEnoughHistory, false);
});

test("ignores malformed session entries without throwing", () => {
  const r = computeReadingProgress({
    pageCount: 100,
    currentPage: 30,
    // Cast to silence typescript — the function must defend itself at runtime.
    sessions: [
      null as unknown as { date: string; minutes: number; pagesRead: number },
      { date: "x", minutes: -5, pagesRead: -10 },
      { date: "y", minutes: 20, pagesRead: 30 },
    ],
  });
  assert.equal(r.hasEnoughHistory, true);
  assert.equal(r.pagesLeft, 70);
});

test("aggregates multiple sessions into one rate", () => {
  // 90 pages in 45 minutes across two sessions = 2 p/m. 90 left → 45 min.
  const r = computeReadingProgress({
    pageCount: 200,
    currentPage: 110,
    sessions: [
      { date: "2026-06-28", minutes: 30, pagesRead: 60 },
      { date: "2026-06-30", minutes: 15, pagesRead: 30 },
    ],
  });
  assert.equal(r.hasEnoughHistory, true);
  assert.equal(r.avgPagesPerMinute, 2);
  assert.equal(r.estMinutes, 45);
});
