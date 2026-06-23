// Agata — server functions for goals + key-value settings. Zod-validated.
import { createServerFn } from "@tanstack/react-start";
import * as goalsRepo from "@/lib/db/repositories/goals";
import { GoalsInputSchema, SettingKeySchema, SettingPutSchema } from "@/lib/api/schemas";

export const getGoals = createServerFn({ method: "POST" }).handler(async () => {
  return goalsRepo.getGoals();
});

export const setGoals = createServerFn({ method: "POST" })
  .validator(GoalsInputSchema)
  .handler(async ({ data }) => goalsRepo.setGoals(data));

// ---------- settings (generic k/v) ----------

export const getSetting = createServerFn({ method: "POST" })
  .validator(SettingKeySchema)
  .handler(async ({ data }) => ({
    key: data.key,
    // Setting values are arbitrary JSON parsed by the repo. `any` is the
    // escape hatch for TanStack's serializable-type check — the actual
    // wire format goes through JSON.stringify/parse and is type-erased
    // by the client anyway. We can't narrow it to a specific shape
    // because settings is a generic k/v store.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    value: (await goalsRepo.getSetting(data.key)) as any,
  }));

export const setSetting = createServerFn({ method: "POST" })
  .validator(SettingPutSchema)
  .handler(async ({ data }) => {
    await goalsRepo.setSetting(data.key, data.value);
    return { ok: true };
  });

export const deleteSetting = createServerFn({ method: "POST" })
  .validator(SettingKeySchema)
  .handler(async ({ data }) => {
    await goalsRepo.deleteSetting(data.key);
    return { ok: true };
  });
