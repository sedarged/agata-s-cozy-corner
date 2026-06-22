// Pure parser for the GoalsPanel form. Used by GoalsPanel before calling
// useSetGoalsMutation so we clamp and normalise on the client side and
// never persist fractional or negative values (the server Zod schema
// already enforces nonnegative ints — this is for UX consistency).
export interface RawGoalsInput {
  yearlyBooksRaw: string;
  weeklyMinutesRaw: string;
}

export interface ParsedGoals {
  yearlyBooks: number;
  weeklyMinutes: number;
}

export function parseGoalsInput(input: RawGoalsInput): ParsedGoals {
  return {
    yearlyBooks: parseNonNegativeInt(input.yearlyBooksRaw),
    weeklyMinutes: parseNonNegativeInt(input.weeklyMinutesRaw),
  };
}

export function parseNonNegativeInt(raw: string): number {
  const trimmed = (raw ?? "").trim();
  if (!trimmed) return 0;
  const n = Number(trimmed);
  if (!Number.isFinite(n)) return 0;
  const rounded = Math.round(n);
  if (rounded <= 0) return 0; // also collapses -0 to +0
  return rounded;
}