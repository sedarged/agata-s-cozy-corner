import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import {
  buildBackup,
  downloadBackup,
  importBackup,
  estimateStorageBytes,
  formatBytes,
  type AgataBackup,
  type ImportMode,
} from "@/lib/backup";

const LAST_EXPORT_KEY = "agata-last-export-at";
const LAST_IMPORT_KEY = "agata-last-import-at";
const LAST_IMPORT_MODE_KEY = "agata-last-import-mode";

function readStr(key: string): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}
function writeStr(key: string, value: string) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, value);
  } catch {
    /* noop */
  }
}

function fmtDateTime(iso: string | null): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString("pl-PL", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

function countArr(v: unknown): number {
  return Array.isArray(v) ? v.length : 0;
}
function countMap(v: unknown): number {
  return v && typeof v === "object" ? Object.keys(v as Record<string, unknown>).length : 0;
}

interface DryRun {
  books: number;
  notes: number;
  sessions: number;
  goals: number;
  drafts: number;
  handwritingPrefs: boolean;
  fileSize: number;
}

export function BackupPanel() {
  const fileRef = useRef<HTMLInputElement>(null);
  const [mode, setMode] = useState<ImportMode>("merge");
  const [bytes] = useState(() => estimateStorageBytes());
  const [exportSize, setExportSize] = useState<number | null>(null);
  const [lastExport, setLastExport] = useState<string | null>(null);
  const [lastImport, setLastImport] = useState<string | null>(null);
  const [lastImportMode, setLastImportMode] = useState<string | null>(null);
  const [pending, setPending] = useState<{ json: AgataBackup; summary: DryRun } | null>(null);

  useEffect(() => {
    setLastExport(readStr(LAST_EXPORT_KEY));
    setLastImport(readStr(LAST_IMPORT_KEY));
    setLastImportMode(readStr(LAST_IMPORT_MODE_KEY));
    try {
      const json = JSON.stringify(buildBackup());
      setExportSize(new Blob([json]).size);
    } catch {
      setExportSize(null);
    }
  }, []);

  const lastImportLabel = useMemo(() => {
    if (!lastImport) return "—";
    const ts = fmtDateTime(lastImport);
    const m = lastImportMode === "replace" ? "zastąp" : "dołącz";
    return `${ts} (${m})`;
  }, [lastImport, lastImportMode]);

  function onDownload() {
    downloadBackup();
    const now = new Date().toISOString();
    writeStr(LAST_EXPORT_KEY, now);
    setLastExport(now);
  }

  function onPick() {
    fileRef.current?.click();
  }

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    try {
      const text = await f.text();
      const json = JSON.parse(text) as AgataBackup;
      if (json?.app !== "agata" || !json?.data) {
        toast.error("To nie jest kopia Agaty.");
        return;
      }
      const d = json.data ?? {};
      const booksData = d.books as
        | { localBooks?: unknown[]; overrides?: Record<string, unknown> }
        | undefined;
      const summary: DryRun = {
        books: countArr(booksData?.localBooks) + countMap(booksData?.overrides),
        notes: countArr(d.notes),
        sessions: countArr(d.readingSessions),
        goals: d.goals ? 1 : 0,
        drafts: countMap(d.noteDrafts),
        handwritingPrefs: !!(d as { handwritingPrefs?: unknown }).handwritingPrefs,
        fileSize: f.size,
      };
      setPending({ json, summary });
    } catch {
      toast.error("Plik nie wygląda na poprawną kopię JSON.");
    }
  }

  function confirmImport() {
    if (!pending) return;
    const res = importBackup(pending.json, mode);
    if (res.ok) {
      const now = new Date().toISOString();
      writeStr(LAST_IMPORT_KEY, now);
      writeStr(LAST_IMPORT_MODE_KEY, mode);
      setLastImport(now);
      setLastImportMode(mode);
      setPending(null);
      toast.success("Kopia została wczytana.");
      setTimeout(() => window.location.reload(), 500);
    } else {
      toast.error(res.error || "Nie udało się wczytać kopii.");
      setPending(null);
    }
  }

  return (
    <div className="space-y-5">
      <p className="text-sm text-muted-foreground">
        Wszystkie dane Agaty są zapisywane lokalnie na tym urządzeniu. Regularnie wykonuj kopię
        zapasową — szczególnie przed wyczyszczeniem przeglądarki.
      </p>

      <div className="grid sm:grid-cols-3 gap-2 text-xs">
        <Info label="Wykorzystane miejsce" value={formatBytes(bytes)} />
        <Info
          label="Rozmiar pliku eksportu"
          value={exportSize != null ? formatBytes(exportSize) : "—"}
        />
        <Info label="Ostatni eksport" value={fmtDateTime(lastExport)} />
        <Info label="Ostatni import" value={lastImportLabel} />
      </div>

      <div className="flex flex-wrap gap-3">
        <button
          onClick={onDownload}
          className="px-5 py-2.5 rounded-full bg-primary text-primary-foreground text-sm"
        >
          Pobierz kopię (.json)
        </button>
        <button onClick={onPick} className="px-5 py-2.5 rounded-full border border-border text-sm">
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

      {pending && (
        <div
          className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="backup-dialog-title"
        >
          <div className="bg-background border border-border rounded-2xl p-6 max-w-md w-full space-y-4">
            <h3 id="backup-dialog-title" className="font-serif text-xl">
              Potwierdź import
            </h3>
            <div className="text-sm text-muted-foreground">
              Tryb: <strong>{mode === "replace" ? "Zastąp" : "Dołącz"}</strong>
            </div>
            <ul className="text-sm space-y-1.5">
              <li>
                Książek w kopii: <strong>{pending.summary.books}</strong>
              </li>
              <li>
                Notatek w kopii: <strong>{pending.summary.notes}</strong>
              </li>
              <li>
                Sesji czytania w kopii: <strong>{pending.summary.sessions}</strong>
              </li>
              <li>
                Cele zapisane w kopii: <strong>{pending.summary.goals ? "tak" : "nie"}</strong>
              </li>
              {pending.summary.drafts > 0 && (
                <li>
                  Szkice notatek: <strong>{pending.summary.drafts}</strong>
                </li>
              )}
              <li>
                Ustawienia notatek odręcznych:{" "}
                <strong>{pending.summary.handwritingPrefs ? "tak" : "nie"}</strong>
              </li>
              <li className="text-muted-foreground">
                Rozmiar pliku: <strong>{formatBytes(pending.summary.fileSize)}</strong>
              </li>
            </ul>
            {mode === "replace" && (
              <div className="text-xs text-[var(--accent-gold)]">
                Uwaga: tryb „Zastąp" usunie obecne dane przed wczytaniem kopii.
              </div>
            )}
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setPending(null)}
                className="px-4 py-2 rounded-full border border-border text-sm"
              >
                Anuluj
              </button>
              <button
                onClick={confirmImport}
                className="px-4 py-2 rounded-full bg-primary text-primary-foreground text-sm font-medium"
              >
                Importuj
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="p-3 rounded-xl bg-muted">
      <div className="text-[10px] uppercase tracking-widest text-muted-foreground">{label}</div>
      <div className="text-sm font-medium mt-0.5 break-words">{value}</div>
    </div>
  );
}
