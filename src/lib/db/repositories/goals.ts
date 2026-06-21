// Agata — goals + settings repositories. Small key-value tables.
import { eq } from "drizzle-orm";
import { getDb } from "../client";
import { goals, settings } from "../schema";
import type { GoalRow, SettingRow } from "../types";

const nowIso = () => new Date().toISOString();

const DEFAULTS: Omit<GoalRow, "id" | "updatedAt"> = {
  yearlyBooks: 24,
  weeklyMinutes: 210,
};

export async function getGoals(): Promise<GoalRow> {
  const row = getDb().select().from(goals).where(eq(goals.id, "default")).get() as
    | GoalRow
    | undefined;
  if (row) return row;
  // Seed with defaults.
  getDb()
    .insert(goals)
    .values({ id: "default", ...DEFAULTS, updatedAt: nowIso() })
    .onConflictDoNothing()
    .run();
  return (getDb().select().from(goals).where(eq(goals.id, "default")).get() as GoalRow)!;
}

export async function setGoals(
  patch: Partial<Pick<GoalRow, "yearlyBooks" | "weeklyMinutes">>,
): Promise<GoalRow> {
  await getGoals();
  const updated: Partial<GoalRow> = {
    ...patch,
    updatedAt: nowIso(),
  };
  getDb().update(goals).set(updated).where(eq(goals.id, "default")).run();
  return (getDb().select().from(goals).where(eq(goals.id, "default")).get() as GoalRow)!;
}

// ---------- settings (key-value) ----------

export async function getSetting<T = unknown>(key: string): Promise<T | undefined> {
  const row = getDb().select().from(settings).where(eq(settings.key, key)).get() as
    | SettingRow
    | undefined;
  if (!row) return undefined;
  try {
    return JSON.parse(row.value) as T;
  } catch {
    return undefined;
  }
}

export async function setSetting<T = unknown>(key: string, value: T): Promise<void> {
  const text = JSON.stringify(value);
  getDb()
    .insert(settings)
    .values({ key, value: text, updatedAt: nowIso() })
    .onConflictDoUpdate({
      target: settings.key,
      set: { value: text, updatedAt: nowIso() },
    })
    .run();
}

export async function deleteSetting(key: string): Promise<void> {
  getDb().delete(settings).where(eq(settings.key, key)).run();
}

export async function listSettings(): Promise<{ key: string; value: unknown }[]> {
  const rows = getDb().select().from(settings).all() as SettingRow[];
  return rows.map((r) => {
    let value: unknown = r.value;
    try {
      value = JSON.parse(r.value);
    } catch {
      /* keep as string */
    }
    return { key: r.key, value };
  });
}
