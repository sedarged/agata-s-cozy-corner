import { useRef, useState } from "react";
import { toast } from "sonner";
import {
  downloadBackup,
  importBackup,
  estimateStorageBytes,
  formatBytes,
  type ImportMode,
} from "@/lib/backup";

export function BackupPanel() {
  const fileRef = useRef<HTMLInputElement>(null);
  const [mode, setMode] = useState<ImportMode>("merge");
  const [bytes] = useState(() => estimateStorageBytes());

  function onPick() {
    fileRef.current?.click();
  }

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    try {
      const text = await f.text();
      const json = JSON.parse(text);
      const res = importBackup(json, mode);
      if (res.ok) {
        toast.success("Kopia została wczytana.");
        setTimeout(() => window.location.reload(), 500);
      } else {
        toast.error(res.error || "Nie udało się wczytać kopii.");
      }
    } catch {
      toast.error("Plik nie wygląda na poprawną kopię JSON.");
    }
  }

  return (
    <div className="space-y-5">
      <p className="text-sm text-muted-foreground">
        Wszystkie dane Agaty są zapisywane lokalnie na tym urządzeniu. Regularnie wykonuj kopię
        zapasową — szczególnie przed wyczyszczeniem przeglądarki.
      </p>

      <div className="p-4 rounded-xl bg-muted text-xs text-muted-foreground">
        Wykorzystane miejsce lokalne: <strong>{formatBytes(bytes)}</strong>
      </div>

      <div className="flex flex-wrap gap-3">
        <button
          onClick={() => downloadBackup()}
          className="px-5 py-2.5 rounded-full bg-primary text-primary-foreground text-sm"
        >
          Pobierz kopię (.json)
        </button>
        <button
          onClick={onPick}
          className="px-5 py-2.5 rounded-full border border-border text-sm"
        >
          Wczytaj kopię…
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="application/json,.json"
          className="hidden"
          onChange={onFile}
        />
      </div>

      <fieldset className="border border-border rounded-xl p-4">
        <legend className="text-xs px-2 text-muted-foreground">Tryb wczytywania</legend>
        <label className="flex items-start gap-3 py-1.5 cursor-pointer">
          <input
            type="radio"
            name="mode"
            value="merge"
            checked={mode === "merge"}
            onChange={() => setMode("merge")}
            className="mt-1"
          />
          <span className="text-sm">
            <strong>Dołącz</strong> — bezpiecznie scal dane z kopii z bieżącymi (bez nadpisywania
            istniejących wpisów).
          </span>
        </label>
        <label className="flex items-start gap-3 py-1.5 cursor-pointer">
          <input
            type="radio"
            name="mode"
            value="replace"
            checked={mode === "replace"}
            onChange={() => setMode("replace")}
            className="mt-1"
          />
          <span className="text-sm">
            <strong>Zastąp</strong> — usuń obecne dane i wczytaj te z kopii.
          </span>
        </label>
      </fieldset>
    </div>
  );
}
