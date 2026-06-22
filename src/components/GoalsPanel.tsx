import { useEffect, useState } from "react";
import { toast } from "sonner";
import { useGoalsQuery, useSetGoalsMutation } from "@/lib/api/client";
import { parseGoalsInput } from "@/components/goals-input";

// Migration note (Phase 1.5): this component used to read from
// `@/lib/goals-store` (localStorage). The store was the source of truth
// while the server had no goals table. After the SQLite migration the
// server is authoritative — this panel now mirrors the React Query
// pattern used by `useBooksQuery` etc. The localStorage shim stays only
// for backup-format compatibility and will be deleted with the rest of
// the store layer.
export function GoalsPanel() {
  const { data: goals } = useGoalsQuery();
  const setGoals = useSetGoalsMutation();

  const [yearly, setYearly] = useState("");
  const [weekly, setWeekly] = useState("");

  // Sync local form state once the server returns goals. We only init
  // when the input is empty so the user can keep editing while the
  // background refetch lands.
  useEffect(() => {
    if (goals && !yearly && !weekly) {
      setYearly(String(goals.yearlyBooks));
      setWeekly(String(goals.weeklyMinutes));
    }
  }, [goals, yearly, weekly]);

  const onSave = async () => {
    const parsed = parseGoalsInput({ yearlyBooksRaw: yearly, weeklyMinutesRaw: weekly });
    try {
      await setGoals.mutateAsync({ data: parsed });
      toast.success("Cele zapisane");
    } catch {
      toast.error("Nie udało się zapisać celów");
    }
  };

  const busy = setGoals.isPending;

  return (
    <div className="space-y-5">
      <p className="text-sm text-muted-foreground">
        Ustaw swoje cele czytelnicze. Postęp policzy się automatycznie z Twoich sesji i ukończonych
        książek.
      </p>

      <label className="block">
        <div className="text-xs uppercase tracking-widest text-muted-foreground mb-2">
          Cel roczny — książki
        </div>
        <input
          type="number"
          inputMode="numeric"
          min={0}
          value={yearly}
          onChange={(e) => setYearly(e.target.value)}
          disabled={busy}
          className="w-full px-4 py-3 rounded-xl border border-border bg-background disabled:opacity-60"
        />
      </label>

      <label className="block">
        <div className="text-xs uppercase tracking-widest text-muted-foreground mb-2">
          Cel tygodniowy — minuty czytania
        </div>
        <input
          type="number"
          inputMode="numeric"
          min={0}
          value={weekly}
          onChange={(e) => setWeekly(e.target.value)}
          disabled={busy}
          className="w-full px-4 py-3 rounded-xl border border-border bg-background disabled:opacity-60"
        />
        <div className="text-xs text-muted-foreground mt-1.5">Np. 210 = pół godziny dziennie.</div>
      </label>

      <button
        onClick={onSave}
        disabled={busy}
        className="w-full py-3 rounded-xl bg-primary text-primary-foreground font-medium hover:opacity-90 disabled:opacity-60"
      >
        {busy ? "Zapisuję…" : "Zapisz cele"}
      </button>
    </div>
  );
}