import { useEffect, useState } from "react";
import { getGoals, saveGoals, useGoalsVersion } from "@/lib/goals-store";
import { toast } from "sonner";

export function GoalsPanel() {
  useGoalsVersion();
  const stored = getGoals();
  const [yearly, setYearly] = useState(String(stored.yearlyBooks));
  const [weekly, setWeekly] = useState(String(stored.weeklyMinutes));

  useEffect(() => {
    setYearly(String(stored.yearlyBooks));
    setWeekly(String(stored.weeklyMinutes));
  }, [stored.yearlyBooks, stored.weeklyMinutes]);

  const onSave = () => {
    const y = Math.max(0, Math.round(Number(yearly) || 0));
    const w = Math.max(0, Math.round(Number(weekly) || 0));
    const res = saveGoals({ yearlyBooks: y, weeklyMinutes: w });
    if (res.ok) toast.success("Cele zapisane");
    else toast.error("Nie udało się zapisać celów");
  };

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
          className="w-full px-4 py-3 rounded-xl border border-border bg-background"
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
          className="w-full px-4 py-3 rounded-xl border border-border bg-background"
        />
        <div className="text-xs text-muted-foreground mt-1.5">Np. 210 = pół godziny dziennie.</div>
      </label>

      <button
        onClick={onSave}
        className="w-full py-3 rounded-xl bg-primary text-primary-foreground font-medium hover:opacity-90"
      >
        Zapisz cele
      </button>
    </div>
  );
}
