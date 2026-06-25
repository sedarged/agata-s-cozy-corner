// Agata — Settings → Prywatność i dostęp Gigi → OpenAI key card.
//
// Three branches driven by the /api/openai-key/status response:
//   "none"   — empty form (password input + model select + Zapisz)
//   "stored" — saved-key panel with masked key + Usuń
//   "env"    — amber banner (env var wins) + collapsible form
//
// The key is encrypted at rest via AGATA_SECRETS_KEY; the full key is
// never returned from the server after the initial save.
import { useEffect, useState } from "react";
import { Key, Trash2, CheckCircle2, AlertCircle, Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";

import {
  useDeleteOpenAIKeyMutation,
  useOpenAIKeyStatusQuery,
  useSaveOpenAIKeyMutation,
} from "@/lib/api/client";
import { OPENAI_KEY_MODELS, type OpenAIKeyModel } from "@/lib/api/schemas";
import { classifySaveError, isValidOpenAIKeyShape } from "./OpenAIKeyCard.helpers";

export function OpenAIKeyCard() {
  const statusQuery = useOpenAIKeyStatusQuery();
  const saveMutation = useSaveOpenAIKeyMutation();
  const deleteMutation = useDeleteOpenAIKeyMutation();

  const [apiKey, setApiKey] = useState("");
  const [model, setModel] = useState<OpenAIKeyModel>("gpt-5.4-mini");
  const [reveal, setReveal] = useState(false);
  const [showEnvOverride, setShowEnvOverride] = useState(false);

  // When the status query resolves to "stored", lock the form to the
  // saved model so the dropdown starts on the same value.
  useEffect(() => {
    const s = statusQuery.data;
    if (
      s?.source === "stored" &&
      s.model &&
      (OPENAI_KEY_MODELS as readonly string[]).includes(s.model)
    ) {
      setModel(s.model as OpenAIKeyModel);
    }
  }, [statusQuery.data]);

  async function handleSave() {
    const trimmed = apiKey.trim();
    if (!isValidOpenAIKeyShape(trimmed)) {
      toast.error("Nieprawidłowy format klucza OpenAI (powinien zaczynać się od sk- lub sk-proj-)");
      return;
    }
    try {
      await saveMutation.mutateAsync({ apiKey: trimmed, model });
      setApiKey("");
      setReveal(false);
      toast.success("Zapisano klucz OpenAI.");
    } catch (err) {
      toast.error(classifySaveError(err).message);
    }
  }

  async function handleDelete() {
    try {
      await deleteMutation.mutateAsync();
      toast.success("Usunięto klucz OpenAI.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err));
    }
  }

  if (statusQuery.isPending) {
    return (
      <div className="mt-4 text-sm text-muted-foreground">Ładowanie statusu klucza OpenAI…</div>
    );
  }

  const status = statusQuery.data;

  return (
    <div className="mt-4 space-y-4" data-testid="openai-key-card">
      {status?.source === "env" && (
        <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 text-sm">
          <div className="flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-amber-600 mt-0.5" aria-hidden />
            <div>
              Klucz API OpenAI jest ustawiony w zmiennych środowiskowych serwera (
              <code className="font-mono">OPENAI_API_KEY</code> w
              <code className="font-mono"> /etc/agata.env</code>). Aby użyć innego klucza,{" "}
              <button
                type="button"
                onClick={() => setShowEnvOverride((v) => !v)}
                className="underline underline-offset-2"
              >
                {showEnvOverride ? "ukryj formularz" : "wklej własny poniżej"}
              </button>
              .
            </div>
          </div>
        </div>
      )}

      {status?.source === "stored" && (
        <div className="p-4 rounded-xl bg-primary/10 border border-primary/20">
          <div className="flex items-start gap-3">
            <CheckCircle2 className="w-5 h-5 text-primary mt-0.5" aria-hidden />
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium">Zapisano klucz OpenAI</div>
              <div className="text-xs text-muted-foreground mt-0.5 truncate">
                model <code className="font-mono">{status.model}</code> ·{" "}
                <code className="font-mono">{status.masked}</code>
              </div>
            </div>
            <button
              type="button"
              onClick={handleDelete}
              disabled={deleteMutation.isPending}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-destructive text-destructive-foreground text-xs font-medium hover:opacity-90 disabled:opacity-50"
            >
              <Trash2 className="w-3.5 h-3.5" aria-hidden />
              Usuń
            </button>
          </div>
        </div>
      )}

      {(status?.source === "none" || (status?.source === "env" && showEnvOverride)) && (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Wklej swój klucz API OpenAI. Jest szyfrowany (AES-256-GCM) i przechowywany lokalnie na
            serwerze — używany tylko do rozmów z Gigi.
          </p>
          <div className="space-y-2">
            <label htmlFor="openai-api-key" className="block text-xs font-medium">
              Klucz API OpenAI
            </label>
            <div className="relative">
              <input
                id="openai-api-key"
                type={reveal ? "text" : "password"}
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="sk-… lub sk-proj-…"
                autoComplete="off"
                spellCheck={false}
                className="w-full px-3 py-2 pr-10 rounded-xl border border-border bg-background text-sm font-mono"
              />
              <button
                type="button"
                onClick={() => setReveal((v) => !v)}
                aria-label={reveal ? "Ukryj klucz" : "Pokaż klucz"}
                className="absolute right-2 top-1/2 -translate-y-1/2 w-7 h-7 grid place-items-center text-muted-foreground hover:text-foreground"
              >
                {reveal ? (
                  <EyeOff className="w-4 h-4" aria-hidden />
                ) : (
                  <Eye className="w-4 h-4" aria-hidden />
                )}
              </button>
            </div>

            <label htmlFor="openai-api-model" className="block text-xs font-medium">
              Model
            </label>
            <select
              id="openai-api-model"
              value={model}
              onChange={(e) => setModel(e.target.value as OpenAIKeyModel)}
              className="w-full px-3 py-2 rounded-xl border border-border bg-background text-sm"
            >
              {OPENAI_KEY_MODELS.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>

            <button
              type="button"
              onClick={handleSave}
              disabled={!isValidOpenAIKeyShape(apiKey) || saveMutation.isPending}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 disabled:opacity-50"
            >
              <Key className="w-4 h-4" aria-hidden />
              {saveMutation.isPending ? "Zapisuję…" : "Zapisz klucz"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
