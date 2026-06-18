import { useSyncExternalStore } from "react";
import { emitQuotaEvent } from "./backup";

export const GOALS_KEY = "agata-goals-v1";

export interface ReadingGoals {
  yearlyBooks: number;
  weeklyMinutes: number;
  updatedAt: string;
}

const defaults: ReadingGoals = {
  yearlyBooks: 24,
  weeklyMinutes: 210,
  updatedAt: new Date(0).toISOString(),
};

type Listener = () => void;
const listeners = new Set<Listener>();
let version = 0;
const bump = () => {
  version++;
  listeners.forEach((l) => l());
};

const isClient = () => typeof window !== "undefined";

export function getGoals(): ReadingGoals {
  if (!isClient()) return defaults;
  try {
    const raw = window.localStorage.getItem(GOALS_KEY);
    if (!raw) return defaults;
    const v = JSON.parse(raw);
    return {
      yearlyBooks: Number.isFinite(v?.yearlyBooks) ? Math.max(0, Math.round(v.yearlyBooks)) : defaults.yearlyBooks,
      weeklyMinutes: Number.isFinite(v?.weeklyMinutes) ? Math.max(0, Math.round(v.weeklyMinutes)) : defaults.weeklyMinutes,
      updatedAt: typeof v?.updatedAt === "string" ? v.updatedAt : defaults.updatedAt,
    };
  } catch {
    return defaults;
  }
}

export function saveGoals(patch: Partial<Pick<ReadingGoals, "yearlyBooks" | "weeklyMinutes">>): { ok: boolean; quota?: boolean } {
  if (!isClient()) return { ok: false };
  const next: ReadingGoals = {
    ...getGoals(),
    ...patch,
    updatedAt: new Date().toISOString(),
  };
  try {
    window.localStorage.setItem(GOALS_KEY, JSON.stringify(next));
    bump();
    return { ok: true };
  } catch (e) {
    const quota = e instanceof Error && /quota|exceeded/i.test(e.message);
    if (quota) emitQuotaEvent("other");
    return { ok: false, quota };
  }
}

function subscribe(l: Listener) {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
}

export function useGoalsVersion(): number {
  return useSyncExternalStore(
    subscribe,
    () => version,
    () => 0,
  );
}
