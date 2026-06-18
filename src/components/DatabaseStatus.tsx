import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { CheckCircle2, XCircle, Loader2, Database } from "lucide-react";
import {
  getDatabaseStatus,
  type DatabaseStatus as DbStatus,
} from "@/lib/db-status.functions";
import { supabase } from "@/integrations/supabase/client";

type ClientCheck = {
  ok: boolean;
  url: string;
  error?: string;
  sample?: unknown;
};

const MY_PROJECT_HOST = "ouzupwvdrzpzvquacjqq.supabase.co";

export function DatabaseStatus() {
  const ping = useServerFn(getDatabaseStatus);
  const [loading, setLoading] = useState(false);
  const [server, setServer] = useState<DbStatus | null>(null);
  const [client, setClient] = useState<ClientCheck | null>(null);

  async function runCheck() {
    setLoading(true);
    setServer(null);
    setClient(null);
    try {
      const [srv, cli] = await Promise.all([
        ping().catch((e) => ({ error: e instanceof Error ? e.message : String(e) })),
        runClientCheck(),
      ]);
      if ("error" in (srv as object) && !(srv as DbStatus).timestamp) {
        setServer({
          ok: false,
          projectUrl: null,
          usingMySupabase: false,
          adminRead: { ok: false, error: (srv as { error: string }).error },
          adminWriteRead: { ok: false },
          timestamp: new Date().toISOString(),
        });
      } else {
        setServer(srv as DbStatus);
      }
      setClient(cli);
    } finally {
      setLoading(false);
    }
  }

  async function runClientCheck(): Promise<ClientCheck> {
    const url = import.meta.env.VITE_SUPABASE_URL ?? "";
    try {
      const { data, error } = await supabase
        .from("app_config")
        .select("id, created_at")
        .eq("id", 1)
        .maybeSingle();
      if (error) return { ok: false, url, error: error.message };
      return { ok: true, url, sample: data };
    } catch (e) {
      return {
        ok: false,
        url,
        error: e instanceof Error ? e.message : String(e),
      };
    }
  }

  const serverPointsToMine = server?.projectUrl?.includes(MY_PROJECT_HOST) ?? false;
  const clientPointsToMine = client?.url.includes(MY_PROJECT_HOST) ?? false;
  const allGreen =
    server?.ok &&
    serverPointsToMine &&
    client?.ok &&
    clientPointsToMine;

  return (
    <div className="space-y-5">
      <p className="text-sm text-muted-foreground">
        Sprawdza, czy frontend i server functions łączą się z Twoim projektem
        Supabase (<code className="text-xs">{MY_PROJECT_HOST}</code>) oraz czy
        zapis i odczyt do bazy działa.
      </p>

      <button
        onClick={runCheck}
        disabled={loading}
        className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-medium disabled:opacity-60"
      >
        {loading ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : (
          <Database className="w-4 h-4" />
        )}
        {loading ? "Sprawdzam..." : "Uruchom test"}
      </button>

      {(server || client) && (
        <div className="space-y-3">
          <Row
            label="Frontend → Supabase URL"
            ok={!!client?.ok && clientPointsToMine}
            detail={
              client?.url
                ? `${client.url}${clientPointsToMine ? " ✓ Twój projekt" : " ✗ inny projekt"}`
                : "brak"
            }
            error={client?.error}
          />
          <Row
            label="Frontend → odczyt app_config"
            ok={!!client?.ok}
            detail={
              client?.ok ? JSON.stringify(client.sample) : undefined
            }
            error={client?.error}
          />
          <Row
            label="Server fn → Supabase URL"
            ok={!!server && serverPointsToMine}
            detail={
              server?.projectUrl
                ? `${server.projectUrl}${serverPointsToMine ? " ✓ Twój projekt" : " ✗ inny projekt"} ${server.usingMySupabase ? "(MY_SUPABASE_URL)" : "(SUPABASE_URL fallback)"}`
                : "brak"
            }
          />
          <Row
            label="Server fn → odczyt (admin)"
            ok={!!server?.adminRead.ok}
            detail={
              server?.adminRead.ok
                ? JSON.stringify(server.adminRead.sample)
                : undefined
            }
            error={server?.adminRead.error}
          />
          <Row
            label="Server fn → zapis + odczyt (admin)"
            ok={!!server?.adminWriteRead.ok}
            detail={
              server?.adminWriteRead.ok
                ? `OK — ${server.adminWriteRead.readBack}`
                : undefined
            }
            error={server?.adminWriteRead.error}
          />

          <div
            className={`mt-4 p-4 rounded-xl text-sm ${
              allGreen
                ? "bg-emerald-50 text-emerald-900 border border-emerald-200"
                : "bg-amber-50 text-amber-900 border border-amber-200"
            }`}
          >
            {allGreen
              ? "✅ Wszystko działa na Twoim Supabase — frontend i server functions połączone, zapis i odczyt OK."
              : "⚠️ Coś nie gra — sprawdź szczegóły powyżej. Najczęstsze przyczyny: migracja SQL nie została uruchomiona w Twoim panelu, brak sekretów MY_SUPABASE_*, lub niepoprawny service role key."}
          </div>
        </div>
      )}
    </div>
  );
}

function Row({
  label,
  ok,
  detail,
  error,
}: {
  label: string;
  ok: boolean;
  detail?: string;
  error?: string;
}) {
  return (
    <div className="flex items-start gap-3 p-3 rounded-xl border border-border bg-card">
      {ok ? (
        <CheckCircle2 className="w-5 h-5 text-emerald-600 mt-0.5 shrink-0" />
      ) : (
        <XCircle className="w-5 h-5 text-destructive mt-0.5 shrink-0" />
      )}
      <div className="min-w-0 flex-1">
        <div className="text-sm font-medium">{label}</div>
        {detail && (
          <div className="text-xs text-muted-foreground break-all mt-0.5">
            {detail}
          </div>
        )}
        {error && (
          <div className="text-xs text-destructive break-all mt-0.5">
            {error}
          </div>
        )}
      </div>
    </div>
  );
}
