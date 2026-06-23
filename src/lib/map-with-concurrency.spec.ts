// map-with-concurrency.spec.ts — TDD for the bounded-concurrency helper
// that protects /api/book-search/batch from resource amplification.

import { test } from "node:test";
import assert from "node:assert/strict";
import { mapWithConcurrency } from "./map-with-concurrency";

test("mapWithConcurrency: runs at most N tasks in parallel", async () => {
  let live = 0;
  let maxLive = 0;
  const work = async (i: number) => {
    live++;
    if (live > maxLive) maxLive = live;
    await new Promise((r) => setTimeout(r, 10));
    live--;
    return i;
  };
  const out = await mapWithConcurrency(3, [10, 20, 30, 40, 50, 60, 70], work);
  assert.deepEqual(out, [10, 20, 30, 40, 50, 60, 70]);
  assert.equal(maxLive, 3, "concurrency cap must hold");
});

test("mapWithConcurrency: preserves input order in the output", async () => {
  // Even if the 0-th task finishes last, its result must be at index 0.
  const work = async (i: number) => {
    if (i === 0) await new Promise((r) => setTimeout(r, 30));
    else await new Promise((r) => setTimeout(r, 5));
    return i * 10;
  };
  const out = await mapWithConcurrency(2, [0, 1, 2, 3], work);
  assert.deepEqual(out, [0, 10, 20, 30]);
});

test("mapWithConcurrency: rejects all on first error (does not partially apply)", async () => {
  const work = async (i: number) => {
    if (i === 2) throw new Error("boom");
    return i;
  };
  await assert.rejects(() => mapWithConcurrency(2, [0, 1, 2, 3], work), /boom/);
});

test("mapWithConcurrency: empty input returns empty output", async () => {
  const out = await mapWithConcurrency(2, [], async () => 1);
  assert.deepEqual(out, []);
});
