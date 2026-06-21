// Agata — Settings card: "Wyślij kopię z tego urządzenia na serwer".
// One-shot migration from localStorage to the server-side SQLite DB.
//
// Flow (per project rule "Import danych ma pokazać liczby do potwierdzenia"):
//   1. Click the button → build the backup payload from localStorage and call
//      `previewImport`. We never write on step 1.
//   2. Show a confirm dialog with the preview counts.
//   3. On confirm → call `applyImport` with the chosen mode. Invalidate the
//      React Query caches so the UI picks up the new server data.
//
// Modes:
//   - merge   (default): upsert books/notes/sessions, mirror tombstones.
//   - replace: wipe books/notes/sessions/tombstones, then import.
import { useState } from "react";
import { toast } from "sonner";
import { CloudUpload, Loader2, AlertTriangle } from "lucide-react";

import { buildBackup } from "@/lib/backup";
import { useImportPreviewMutation, useImportApplyMutation } from "@/lib/api/client";
import type { BackupPayload, ImportPreview } from "@/lib/api/import-schema";

type Mode = "merge" | "replace";

export function MigrateToServerCard() {
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [mode, setMode] = useState<Mode>("merge");
  const [payload, setPayload] = useState<BackupPayload | null>(null);
  const [showConfirm, setShowConfirm] = useState(false);

  const previewMut = useImportPreviewMutation();
  const applyMut = useImportApplyMutation();

  async function handlePreview() {
    try {
      const built = buildBackup() as unknown as BackupPayload;
      setPayload(built);
      const r = await previewMut.mutateAsync({ payload: built });
      setPreview(r);
      setShowConfirm(true);
    } catch (e) {
      toast.error("Nie udało się policzyć kopii", {
        description: (e as Error).message,
      });
    }
  }

  async function handleApply() {
    if (!payload) return;
    try {
      const r = await applyMut.mutateAsync({ payload, mode });
      if (r.ok) {
        toast.success("Kopia wysłana na serwer", {
          description: `Książki: ${r.counts.books}, notatki: ${r.counts.notes}, sesje: ${r.counts.sessions}.`,
        });
      } else {
        toast.warning("Kopia wysłana z błędami", {
          description: r.errors.slice(0, 3).join(" · "),
        });
      }
      setShowConfirm(false);
      setPreview(null);
      setPayload(null);
    } catch (e) {
      toast.error("Wysyłanie kopii nie powiodło się", {
        description: (e as Error).message,
      });
    }
  }

  return (
    <div className="agata-section-panel agata-sheen p-4 sm:p-5 space-y-3">
      <div className="flex items-start gap-3">
        <CloudUpload className="w-5 h-5 gold-text mt-0.5 shrink-0" />
        <div className="flex-1 min-w-0">
          <h3 className="font-serif text-[1.2rem] text-warm leading-tight">
            Wyślij kopię z tego urządzenia na serwer
          </h3>
          <p className="text-[0.86rem] text-warm-muted mt-1.5 leading-relaxed">
            Jednorazowa migracja. Zapisuje książki, notatki, sesje czytania, cele, drafty i
            ustawienia pisma odręcznego. Po stronie serwera nic nie zostanie nadpisane, dopóki nie
            potwierdzisz.
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <label className="text-[0.82rem] text-warm-muted">Tryb:</label>
        <div className="inline-flex rounded-lg border border-border overflow-hidden">
          <button
            type="button"
            onClick={() => setMode("merge")}
            className={
              "px-3 py-1.5 text-[0.82rem] transition " +
              (mode === "merge"
                ? "bg-[var(--champagne)] text-warm"
                : "bg-card text-warm-muted hover:bg-[var(--glass-inner)]")
            }
            aria-pressed={mode === "merge"}
          >
            Dołącz do istniejących
          </button>
          <button
            type="button"
            onClick={() => setMode("replace")}
            className={
              "px-3 py-1.5 text-[0.82rem] transition border-l border-border " +
              (mode === "replace"
                ? "bg-[var(--champagne)] text-warm"
                : "bg-card text-warm-muted hover:bg-[var(--glass-inner)]")
            }
            aria-pressed={mode === "replace"}
          >
            Wyczyść i załaduj tylko to
          </button>
        </div>
      </div>

      <button
        type="button"
        onClick={handlePreview}
        disabled={previewMut.isPending}
        className="agata-cta-row px-4 py-2.5 inline-flex items-center gap-2 text-[0.95rem] text-warm disabled:opacity-60"
      >
        {previewMut.isPending ? (
          <Loader2 className="w-4 h-4 gold-text animate-spin" />
        ) : (
          <CloudUpload className="w-4 h-4 gold-text" />
        )}
        Policz, co zostanie wysłane
      </button>

      {showConfirm && preview && (
        <div
          className="agata-confirm-panel mt-2 p-4 rounded-xl border border-[color:color-mix(in_srgb,var(--champagne)_45%,var(--glass-border))] space-y-3"
          role="dialog"
          aria-labelledby="migrate-confirm-title"
        >
          <div id="migrate-confirm-title" className="font-serif text-[1.05rem] text-warm">
            Potwierdź wysłanie
          </div>
          <ul className="text-[0.86rem] text-warm-muted grid grid-cols-2 gap-x-6 gap-y-1">
            <li>
              Książki: <span className="text-warm">{preview.books}</span>
            </li>
            <li>
              Notatki: <span className="text-warm">{preview.notes}</span>
            </li>
            <li>
              Sesje: <span className="text-warm">{preview.sessions}</span>
            </li>
            <li>
              Cele: <span className="text-warm">{preview.goals}</span>
            </li>
            <li>
              Drafty: <span className="text-warm">{preview.drafts}</span>
            </li>
            <li>
              Pismo odręczne:{" "}
              <span className="text-warm">{preview.handwritingPrefs ? "tak" : "nie"}</span>
            </li>
          </ul>
          {mode === "replace" && (
            <div className="flex items-start gap-2 text-[0.82rem] text-warm-muted bg-[var(--glass-inner)] rounded-lg p-2.5">
              <AlertTriangle className="w-4 h-4 text-warm mt-0.5 shrink-0" />
              <span>
                Tryb „Wyczyść i załaduj" usunie wszystkie obecne książki, notatki i sesje z serwera,
                zanim doda dane z kopii.
              </span>
            </div>
          )}
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={handleApply}
              disabled={applyMut.isPending}
              className="agata-mini-button px-4 py-2 text-[0.9rem] disabled:opacity-60"
            >
              {applyMut.isPending ? (
                <span className="inline-flex items-center gap-2">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" /> Wysyłam…
                </span>
              ) : (
                "Wyślij na serwer"
              )}
            </button>
            <button
              type="button"
              onClick={() => {
                setShowConfirm(false);
                setPreview(null);
                setPayload(null);
              }}
              disabled={applyMut.isPending}
              className="px-4 py-2 text-[0.9rem] text-warm-muted hover:text-warm disabled:opacity-60"
            >
              Anuluj
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
