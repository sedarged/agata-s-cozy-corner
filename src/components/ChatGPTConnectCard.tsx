// Agata — "Połącz ChatGPT" card for the Settings → Prywatność i dostęp Gigi section.
//
// Three flows are supported:
//   1. Browser OAuth: user clicks "Połącz ChatGPT" → new tab to /api/chatgpt/login
//      → auth.openai.com consent → redirect to /api/chatgpt/callback → 302 back to
//      /settings?chatgpt=connected. We poll status on mount to show the toast.
//   2. Paste-the-URL: on mobile/SSH the user can paste the redirected URL into
//      the textarea, we POST { code, state } to /api/chatgpt/exchange.
//   3. Disconnect: POST /api/chatgpt/disconnect removes the encrypted token.
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Link2, Unlink, CheckCircle2, ClipboardPaste, ExternalLink } from "lucide-react";

interface Status {
  connected: boolean;
  accountId?: string;
  expiresAt?: number;
  hasRefreshToken?: boolean;
}

async function fetchStatus(): Promise<Status> {
  const res = await fetch("/api/chatgpt/status", { credentials: "same-origin" });
  if (!res.ok) throw new Error(`Status ${res.status}`);
  return (await res.json()) as Status;
}

async function postDisconnect(): Promise<void> {
  const res = await fetch("/api/chatgpt/disconnect", {
    method: "POST",
    credentials: "same-origin",
  });
  if (!res.ok) throw new Error(`Disconnect ${res.status}`);
}

async function postExchange(code: string, state: string): Promise<Status> {
  const res = await fetch("/api/chatgpt/exchange", {
    method: "POST",
    credentials: "same-origin",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ code, state }),
  });
  const data = (await res.json()) as {
    ok?: boolean;
    accountId?: string;
    expiresAt?: number;
    error?: string;
  };
  if (!res.ok || !data.ok) {
    throw new Error(data.error ?? `Exchange ${res.status}`);
  }
  return { connected: true, accountId: data.accountId, expiresAt: data.expiresAt };
}

/** Parse `?code=...&state=...` out of a pasted URL or `code state` pair. */
function parsePaste(raw: string): { code: string; state: string } | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  // Try as URL first.
  try {
    const u = new URL(trimmed);
    const code = u.searchParams.get("code");
    const state = u.searchParams.get("state");
    if (code && state) return { code, state };
  } catch {
    /* not a URL */
  }
  // Fallback: "code state" on two lines (or two halves of a single line).
  const parts = trimmed.split(/[\s?&]+/).filter(Boolean);
  if (parts.length >= 2) {
    const code = parts.find((p) => p.startsWith("code="))?.slice("code=".length);
    const state = parts.find((p) => p.startsWith("state="))?.slice("state=".length);
    if (code && state) return { code, state };
  }
  return null;
}

function formatExpiry(expiresAt: number | undefined): string {
  if (!expiresAt) return "—";
  const ms = expiresAt - Date.now();
  if (ms <= 0) return "wygasł";
  const min = Math.round(ms / 60_000);
  if (min < 60) return `wygasa za ${min} min`;
  const hr = Math.round(min / 60);
  return `wygasa za ${hr} godz.`;
}

export function ChatGPTConnectCard() {
  const [status, setStatus] = useState<Status | null>(null);
  const [pasteOpen, setPasteOpen] = useState(false);
  const [pasteValue, setPasteValue] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const s = await fetchStatus();
      setStatus(s);
      return s;
    } catch (e) {
      setStatus({ connected: false });
      return null;
    }
  }, []);

  // Read ?chatgpt=... on mount to surface status / error toasts.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const sp = new URL(window.location.href).searchParams;
    const flag = sp.get("chatgpt");
    if (!flag) return;
    refresh().then((s) => {
      if (flag === "connected" && s?.connected) {
        toast.success(`Połączono z ChatGPT${s.accountId ? ` · konto ${s.accountId}` : ""}`);
      } else if (flag === "connecting") {
        // user just clicked the login button — nothing to do here.
      } else if (flag === "error") {
        const reason = sp.get("reason") ?? "nieznany błąd";
        toast.error(`Połączenie z ChatGPT nieudane: ${reason}`);
      }
      // Clean the URL so a refresh doesn't repeat the toast.
      const cleaned = new URL(window.location.href);
      cleaned.searchParams.delete("chatgpt");
      cleaned.searchParams.delete("account");
      cleaned.searchParams.delete("reason");
      cleaned.searchParams.delete("msg");
      window.history.replaceState({}, "", cleaned.toString());
    });
  }, [refresh]);

  const handleConnect = () => {
    // Mark the URL so the callback can find its way back via window.opener / shared localStorage.
    window.open("/api/chatgpt/login", "_blank", "noopener,noreferrer");
  };

  const handleDisconnect = async () => {
    setBusy(true);
    setError(null);
    try {
      await postDisconnect();
      await refresh();
      toast.success("Rozłączono ChatGPT.");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const handlePasteSubmit = async () => {
    const parsed = parsePaste(pasteValue);
    if (!parsed) {
      setError("Nie widzę `code` ani `state` w tym URL-u. Wklej cały adres z paska przeglądarki.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await postExchange(parsed.code, parsed.state);
      await refresh();
      setPasteOpen(false);
      setPasteValue("");
      toast.success("Połączono z ChatGPT.");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  if (!status) {
    return <div className="mt-4 text-sm text-muted-foreground">Ładowanie statusu ChatGPT…</div>;
  }

  return (
    <div className="mt-4 space-y-4" data-testid="chatgpt-connect-card">
      {status.connected ? (
        <div className="p-4 rounded-xl bg-primary/10 border border-primary/20">
          <div className="flex items-start gap-3">
            <CheckCircle2 className="w-5 h-5 text-primary mt-0.5" aria-hidden="true" />
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium">Połączono z ChatGPT</div>
              {status.accountId && (
                <div className="text-xs text-muted-foreground mt-0.5 truncate">
                  konto <code className="font-mono">{status.accountId}</code> ·{" "}
                  {formatExpiry(status.expiresAt)}
                  {status.hasRefreshToken ? " · auto-odświeżanie" : ""}
                </div>
              )}
            </div>
            <button
              onClick={handleDisconnect}
              disabled={busy}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-destructive text-destructive-foreground text-xs font-medium hover:opacity-90 disabled:opacity-50"
            >
              <Unlink className="w-3.5 h-3.5" aria-hidden="true" />
              Rozłącz
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Połącz konto ChatGPT przez OAuth, żeby Gigi mogła korzystać z Twojego konta ChatGPT
            (subskrypcja Pro/Plus) zamiast z klucza OPENAI_API_KEY. Token jest szyfrowany i
            przechowywany lokalnie na serwerze.
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={handleConnect}
              disabled={busy}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 disabled:opacity-50"
            >
              <Link2 className="w-4 h-4" aria-hidden="true" />
              Połącz ChatGPT
              <ExternalLink className="w-3.5 h-3.5 opacity-60" aria-hidden="true" />
            </button>
            <button
              onClick={() => setPasteOpen((o) => !o)}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-muted text-foreground text-sm font-medium hover:bg-muted/70"
            >
              <ClipboardPaste className="w-4 h-4" aria-hidden="true" />
              Mam URL do wklejenia
            </button>
          </div>
          {pasteOpen && (
            <div className="space-y-2">
              <label htmlFor="chatgpt-paste" className="block text-xs text-muted-foreground">
                Po autoryzacji skopiuj pełny adres URL z paska przeglądarki (zaczyna się od
                <code> http://127.0.0.1:3001/api/chatgpt/callback?code=…</code>) i wklej go tutaj:
              </label>
              <textarea
                id="chatgpt-paste"
                value={pasteValue}
                onChange={(e) => setPasteValue(e.target.value)}
                rows={3}
                placeholder="http://127.0.0.1:3001/api/chatgpt/callback?code=…&state=…"
                className="w-full px-3 py-2 rounded-xl border border-border bg-background text-xs font-mono"
              />
              <div className="flex items-center gap-2">
                <button
                  onClick={handlePasteSubmit}
                  disabled={busy || !pasteValue.trim()}
                  className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-medium hover:opacity-90 disabled:opacity-50"
                >
                  Zatwierdź kod
                </button>
                <button
                  onClick={() => {
                    setPasteOpen(false);
                    setPasteValue("");
                    setError(null);
                  }}
                  className="text-xs text-muted-foreground hover:underline"
                >
                  Anuluj
                </button>
              </div>
            </div>
          )}
        </div>
      )}
      {error && (
        <div className="text-xs text-destructive bg-destructive/10 rounded-lg p-2">{error}</div>
      )}
    </div>
  );
}
