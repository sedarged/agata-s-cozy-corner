// Unit tests for parseGoalsInput — pure parser used by GoalsPanel before
// calling useSetGoalsMutation. Goal: clamp/parse user-typed strings into
// the {yearlyBooks, weeklyMinutes} shape the server expects, with the
// same rules in the client and (via Zod) on the server.
import { test } from "node:test";
import assert from "node:assert/strict";
import { parseGoalsInput, parseNonNegativeInt } from "./goals-input";

test("parseNonNegativeInt: empty string -> 0", () => {
  assert.equal(parseNonNegativeInt(""), 0);
});

test("parseNonNegativeInt: whitespace-only -> 0", () => {
  assert.equal(parseNonNegativeInt("   "), 0);
});

test("parseNonNegativeInt: '0' -> 0", () => {
  assert.equal(parseNonNegativeInt("0"), 0);
});

test("parseNonNegativeInt: '24' -> 24", () => {
  assert.equal(parseNonNegativeInt("24"), 24);
});

test("parseNonNegativeInt: '-5' -> 0 (clamped)", () => {
  assert.equal(parseNonNegativeInt("-5"), 0);
});

test("parseNonNegativeInt: '24.7' -> 25 (rounded)", () => {
  assert.equal(parseNonNegativeInt("24.7"), 25);
});

test("parseNonNegativeInt: '24.4' -> 24 (rounded)", () => {
  assert.equal(parseNonNegativeInt("24.4"), 24);
});

test("parseNonNegativeInt: 'abc' -> 0", () => {
  assert.equal(parseNonNegativeInt("abc"), 0);
});

test("parseNonNegativeInt: 'Infinity' -> 0", () => {
  assert.equal(parseNonNegativeInt("Infinity"), 0);
});

test("parseNonNegativeInt: '-0.5' -> 0 (rounds to -0 then clamped)", () => {
  assert.equal(parseNonNegativeInt("-0.5"), 0);
});

test("parseGoalsInput: parses both fields at once", () => {
  assert.deepEqual(
    parseGoalsInput({ yearlyBooksRaw: "30", weeklyMinutesRaw: "180" }),
    { yearlyBooks: 30, weeklyMinutes: 180 },
  );
});

test("parseGoalsInput: blanks become zeros", () => {
  assert.deepEqual(
    parseGoalsInput({ yearlyBooksRaw: "", weeklyMinutesRaw: "" }),
    { yearlyBooks: 0, weeklyMinutes: 0 },
  );
});

test("parseGoalsInput: garbage in either field -> 0", () => {
  assert.deepEqual(
    parseGoalsInput({ yearlyBooksRaw: "garbage", weeklyMinutesRaw: "-12.5" }),
    { yearlyBooks: 0, weeklyMinutes: 0 },
  );
});

test("parseGoalsInput: undefined raw -> treated as empty", () => {
  // Defensive: the UI binds the input value but during tests the prop can
  // be undefined. Must not throw.
  assert.deepEqual(
    parseGoalsInput({ yearlyBooksRaw: undefined as unknown as string, weeklyMinutesRaw: "10" }),
    { yearlyBooks: 0, weeklyMinutes: 10 },
  );
});