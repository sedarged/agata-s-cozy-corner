import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { CheckCircle2, Loader2, Server } from "lucide-react";
import { getServerHealth } from "@/lib/db-status.functions";
import { estimateStorageBytes, formatBytes } from "@/lib/backup";
import { getAllBooks } from "@/lib/books-store";
import { getAllNotes } from "@/lib/notes-store";

export function DatabaseStatus() {
  const ping = useServerFn(getServerHealth);
  const [loading, setLoading] = useState(false);
  const [health, setHealth] = useState<{
    ok: boolean;
    nodeVersion: string;
    platform: string;
    uptime: number;
    timestamp: string;
  } | null>(null);

  async function runCheck() {
    setLoading(true);
    setHealth(null);
    try {
      const result = await ping().catch(() => null);
      setHealth(result);
    } finally {
      setLoading(false);
    }
  }

  const storageBytes = estimateStorageBytes();
  const books = getAllBooks().length;
  const notes = getAllNotes().length;

  return (
    <div className="space-y-5">
      <p className="text-sm text-muted-foreground">
        Dane przechowywane są lokalnie w przeglądarce (localStorage). Poniżej znajdziesz stan
        pamięci oraz informacje o serwerze Agaty.
      </p>

      <div className="grid sm:grid-cols-3 gap-3">
        <Stat label="Książki" value={String(books)} />
        <Stat label="Notatki" value={String(notes)} />
        <Stat label="Zajęte miejsce" value={formatBytes(storageBytes)} />
      </div>

      <button
        onClick={runCheck}
        disabled={loading}
        className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-medium disabled:opacity-60"
      >
        {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Server className="w-4 h-4" />}
        {loading ? "Sprawdzam…" : "Ping serwera"}
      </button>

      {health && (
        <div className="space-y-3">
          <div className="flex items-start gap-3 p-3 rounded-xl border border-border bg-card">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 mt-0.5 shrink-0" />
            <div className="min-w-0 flex-1 text-sm">
              <div className="font-medium">Serwer odpowiada</div>
              <div className="text-xs text-muted-foreground mt-0.5">
                Node {health.nodeVersion} · {health.platform} · uptime{" "}
                {Math.floor(health.uptime / 60)}m {health.uptime % 60}s
              </div>
            </div>
          </div>
          <div className="text-xs text-muted-foreground">
            Sprawdzono: {new Date(health.timestamp).toLocaleTimeString("pl-PL")}
          </div>
        </div>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="p-4 rounded-xl bg-muted">
      <div className="text-[10px] uppercase tracking-widest text-muted-foreground">{label}</div>
      <div className="text-xl font-semibold mt-1">{value}</div>
    </div>
  );
}
