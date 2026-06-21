import { CheckCircle2, Database, Server, XCircle } from "lucide-react";
import { useDbHealthQuery } from "@/lib/api/client";
import { formatBytes } from "@/lib/backup";

export function DatabaseStatus() {
  const health = useDbHealthQuery();

  // Show the page immediately with a "loading" health card; the query
  // resolves within a few ms on a healthy server.
  const data = health.data;
  const dbBytes = data ? data.dbSizeBytes : 0;
  const ok = health.isSuccess && !!data?.ok;

  return (
    <div className="space-y-5">
      <p className="text-sm text-muted-foreground">
        Twoje dane są przechowywane w bazie SQLite na serwerze Agaty. Poniżej znajdziesz aktualny
        stan bazy oraz podstawowe informacje o środowisku.
      </p>

      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <Stat label="Książki" value={data ? String(data.bookCount) : "—"} />
        <Stat label="Notatki" value={data ? String(data.noteCount) : "—"} />
        <Stat label="Sesje czytania" value={data ? String(data.sessionCount) : "—"} />
        <Stat label="Baza danych" value={formatBytes(dbBytes)} />
      </div>

      <div
        className="flex items-start gap-3 p-3 rounded-xl border border-border bg-card"
        data-testid="db-health-card"
      >
        {health.isPending || health.isLoading ? (
          <Server className="w-5 h-5 text-muted-foreground mt-0.5 shrink-0 animate-pulse" />
        ) : ok ? (
          <CheckCircle2 className="w-5 h-5 text-emerald-600 mt-0.5 shrink-0" />
        ) : (
          <XCircle className="w-5 h-5 text-destructive mt-0.5 shrink-0" />
        )}
        <div className="min-w-0 flex-1 text-sm">
          <div className="font-medium">
            {health.isError
              ? "Nie udało się połączyć z serwerem"
              : ok
                ? "Baza danych działa"
                : "Łączenie z bazą…"}
          </div>
          {data && (
            <div className="text-xs text-muted-foreground mt-0.5 space-y-0.5">
              <div>
                Node {data.nodeVersion} · {data.platform} · uptime {Math.floor(data.uptime / 60)}m{" "}
                {data.uptime % 60}s
              </div>
              <div className="font-mono text-[10px] break-all opacity-70">{data.dbPath}</div>
            </div>
          )}
          {health.isError && (
            <div className="text-xs text-destructive mt-0.5">
              {String((health.error as Error | null)?.message ?? health.error)}
            </div>
          )}
        </div>
      </div>

      {data && (
        <details className="text-xs text-muted-foreground">
          <summary className="cursor-pointer hover:text-foreground">Szczegóły serwera</summary>
          <dl className="mt-2 grid grid-cols-[max-content_1fr] gap-x-3 gap-y-1 pl-2">
            <dt className="font-medium">Katalog danych</dt>
            <dd className="font-mono break-all">{data.dataDir}</dd>
            <dt className="font-medium">Katalog zasobów</dt>
            <dd className="font-mono break-all">{data.assetsDir}</dd>
            <dt className="font-medium">Cele (goals)</dt>
            <dd>{data.goalRowExists ? "ustawione" : "domyślne"}</dd>
          </dl>
        </details>
      )}

      <button
        onClick={() => health.refetch()}
        disabled={health.isFetching}
        className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-medium disabled:opacity-60"
      >
        <Database className="w-4 h-4" />
        {health.isFetching ? "Odświeżam…" : "Odśwież statystyki"}
      </button>
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
