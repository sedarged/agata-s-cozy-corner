import { createFileRoute, Link } from "@tanstack/react-router";
import { PageHeader } from "@/components/PageHeader";
import { useEffect, useState } from "react";
import { Lock, ArrowRight, LogOut, UserRound, Loader2 } from "lucide-react";
import { DatabaseStatus } from "@/components/DatabaseStatus";
import { BackupPanel } from "@/components/BackupPanel";
import { GoalsPanel } from "@/components/GoalsPanel";
import { useAuth } from "@/lib/auth-context";
import {
  checkCloudReadiness,
  compareLocalAndCloud,
  getCloudSyncStatus,
  getLocalCounts,
  type CloudReadiness,
  type ComparisonResult,
} from "@/lib/cloud-sync";

export const Route = createFileRoute("/settings")({
  head: () => ({ meta: [{ title: "Ustawienia — Agata" }] }),
  component: Settings,
});

const sections = [
  "Konto",
  "Synchronizacja z chmurą",
  "Prywatność i dostęp Gigi",
  "Status bazy",
  "Motywy",
  "Cele czytelnicze",
  "Kopia zapasowa",
  "Domyślny status książki",
  "Domyślny styl notatki",
  "Zarządzaj tagami",
  "Pamięć",
  "O Agacie",
];

const gigiOptions = [
  "Wyłączone",
  "Tylko aktualna książka",
  "Tylko wybrane notatki",
  "Cała biblioteka",
  "Cała biblioteka + rozmowy",
];

function Settings() {
  const [section, setSection] = useState(sections[0]);
  const [gigi, setGigi] = useState("Cała biblioteka + rozmowy");
  const { user, signOut } = useAuth();

  return (
    <div>
      <PageHeader title="Ustawienia" subtitle="Twoja przestrzeń, Twoje zasady." />
      <div className="px-5 lg:px-10 grid lg:grid-cols-[260px_1fr] gap-6 pb-12 max-w-5xl">
        <nav className="bg-card rounded-3xl p-3 shadow-soft h-fit">
          {sections.map((s) => (
            <button
              key={s}
              onClick={() => setSection(s)}
              className={`w-full text-left px-3 py-2.5 rounded-xl text-sm ${
                section === s ? "bg-primary text-primary-foreground" : "hover:bg-muted"
              }`}
            >
              {s}
            </button>
          ))}
          {user ? (
            <button
              onClick={() => signOut()}
              className="w-full text-left px-3 py-2.5 rounded-xl text-sm text-destructive hover:bg-muted flex items-center gap-2"
            >
              <LogOut className="w-4 h-4" aria-hidden="true" />
              Wyloguj
            </button>
          ) : (
            <Link
              to="/auth"
              className="w-full text-left px-3 py-2.5 rounded-xl text-sm text-primary hover:bg-muted flex items-center gap-2"
            >
              <UserRound className="w-4 h-4" aria-hidden="true" />
              Zaloguj się
            </Link>
          )}
        </nav>

        <div className="bg-card rounded-3xl p-6 shadow-soft">
          <h2 className="font-serif text-2xl mb-1">{section}</h2>
          {section === "Konto" && (
            <>
              {user ? (
                <div className="space-y-5">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-full bg-primary text-primary-foreground grid place-items-center text-lg font-bold">
                      {user.email?.[0]?.toUpperCase() || "U"}
                    </div>
                    <div>
                      <div className="text-sm font-medium">{user.email}</div>
                      <div className="text-xs text-muted-foreground">Zalogowano</div>
                    </div>
                  </div>
                  <button
                    onClick={() => signOut()}
                    className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-destructive text-destructive-foreground text-sm font-medium hover:opacity-90 transition-opacity"
                  >
                    <LogOut className="w-4 h-4" aria-hidden="true" />
                    Wyloguj
                  </button>
                </div>
              ) : (
                <div className="space-y-5">
                  <p className="text-sm text-muted-foreground">
                    Zaloguj się, aby synchronizować dane między urządzeniami i w przyszłości
                    korzystać z Gigi.
                  </p>
                  <Link
                    to="/auth"
                    className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition-opacity"
                  >
                    Zaloguj się
                    <ArrowRight className="w-4 h-4" aria-hidden="true" />
                  </Link>
                </div>
              )}
            </>
          )}
          {section === "Synchronizacja z chmurą" && <CloudSyncPanel />}
          {section === "Prywatność i dostęp Gigi" && (
            <>
              <p className="text-sm text-muted-foreground">
                Wybierz, do czego Gigi ma dostęp w Twojej bibliotece.
              </p>
              <div className="mt-5 space-y-2">
                {gigiOptions.map((o) => (
                  <button
                    key={o}
                    onClick={() => setGigi(o)}
                    className={`w-full flex items-center justify-between p-4 rounded-xl border transition ${
                      gigi === o ? "border-primary bg-primary/10" : "border-border hover:bg-muted"
                    }`}
                  >
                    <span className="text-sm">{o}</span>
                    <span
                      className={`w-4 h-4 rounded-full border-2 ${
                        gigi === o ? "border-primary bg-primary" : "border-border"
                      }`}
                    />
                  </button>
                ))}
              </div>
              <div className="mt-6 flex items-start gap-2 p-4 rounded-xl bg-muted text-xs text-muted-foreground">
                <Lock className="w-4 h-4 mt-0.5" aria-hidden="true" />
                <div>
                  Wszystko jest prywatne. Tylko Ty widzisz swoje dane — bez publicznych profili,
                  feedu społecznościowego ani reklam.
                </div>
              </div>
            </>
          )}
          {section === "Status bazy" && (
            <div className="mt-4">
              <DatabaseStatus />
            </div>
          )}
          {section === "Kopia zapasowa" && (
            <div className="mt-4">
              <BackupPanel />
            </div>
          )}
          {section === "Cele czytelnicze" && (
            <div className="mt-4">
              <GoalsPanel />
            </div>
          )}
          {section !== "Konto" &&
            section !== "Synchronizacja z chmurą" &&
            section !== "Prywatność i dostęp Gigi" &&
            section !== "Status bazy" &&
            section !== "Kopia zapasowa" &&
            section !== "Cele czytelnicze" && (
              <p className="text-sm text-muted-foreground mt-2">
                Skonfiguruj sekcję „{section.toLowerCase()}" tutaj. To prototyp — pełne ustawienia
                zostaną podpięte do Twojego konta.
              </p>
            )}
        </div>
      </div>
    </div>
  );
}

function CloudSyncPanel() {
  const [readiness, setReadiness] = useState<CloudReadiness | null>(null);
  const [loading, setLoading] = useState(true);
  const [compare, setCompare] = useState<ComparisonResult | null>(null);
  const [busy, setBusy] = useState(false);
  const local = getLocalCounts();

  useEffect(() => {
    let cancelled = false;
    checkCloudReadiness()
      .then((r) => {
        if (!cancelled) {
          setReadiness(r);
          setLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function refresh() {
    setBusy(true);
    const r = await checkCloudReadiness();
    setReadiness(r);
    setBusy(false);
  }

  async function doCompare() {
    setBusy(true);
    const r = await compareLocalAndCloud();
    setReadiness(r.readiness);
    setCompare(r);
    setBusy(false);
  }

  const status = readiness ? getCloudSyncStatus(readiness) : null;
  const statusLabel: Record<NonNullable<typeof status>, string> = {
    "local-only": "Lokalnie",
    "configured-logged-out": "Wymaga logowania",
    "configured-logged-in": "Połączono",
    "config-error": "Błąd konfiguracji",
    "rls-unverified": "RLS niezweryfikowane",
    "owner-gate-unverified": "Owner gate niezweryfikowany",
  };

  const pushDisabled = !readiness || !readiness.canPush;
  const pullDisabled = !readiness || !readiness.canPull;

  return (
    <div className="space-y-5 mt-4">
      <p className="text-sm text-muted-foreground">
        Aplikacja działa lokalnie na tym urządzeniu. Synchronizacja z chmurą jest w tym wydaniu
        wyłączona i pozostanie wyłączona do czasu zweryfikowania zabezpieczeń.
      </p>

      <div className="grid sm:grid-cols-2 gap-3 text-sm">
        <Info label="Stan" value={loading ? "Sprawdzam…" : status ? statusLabel[status] : "—"} />
        <Info label="Zalogowano jako" value={readiness?.email ?? "—"} />
        <Info
          label="Konfiguracja Supabase"
          value={readiness?.configured ? "skonfigurowane" : "brak"}
        />
        <Info
          label="Owner gate"
          value={
            readiness?.ownerVerified === true
              ? "zweryfikowany"
              : readiness?.ownerVerified === false
                ? "niezweryfikowany"
                : "—"
          }
        />
        <Info
          label="RLS użytkownika"
          value={
            readiness?.rlsVerified === false
              ? "brak dostępu"
              : "niezweryfikowane"
          }
        />
      </div>

      <div className="grid sm:grid-cols-2 gap-3">
        <div className="p-4 rounded-xl bg-muted">
          <div className="text-[10px] uppercase tracking-widest text-muted-foreground">
            Dane lokalne
          </div>
          <ul className="text-sm mt-2 space-y-0.5">
            <li>Książki: <strong>{local.books}</strong></li>
            <li>Notatki: <strong>{local.notes}</strong></li>
            <li>Sesje czytania: <strong>{local.sessions}</strong></li>
            {local.notesBlocked > 0 && (
              <li className="text-amber-700">
                Notatki ręczne/zdjęcia (lokalne): <strong>{local.notesBlocked}</strong>
              </li>
            )}
          </ul>
        </div>
        <div className="p-4 rounded-xl bg-muted">
          <div className="text-[10px] uppercase tracking-widest text-muted-foreground">
            Dane w chmurze
          </div>
          {compare?.cloud?.ok ? (
            <ul className="text-sm mt-2 space-y-0.5">
              <li>Książki: <strong>{compare.cloud.books}</strong></li>
              <li>Notatki: <strong>{compare.cloud.notes}</strong></li>
              <li>Sesje czytania: <strong>{compare.cloud.sessions}</strong></li>
            </ul>
          ) : (
            <div className="text-sm text-muted-foreground mt-2">
              {compare?.cloud?.error ?? 'Naciśnij „Porównaj dane", aby pobrać liczniki.'}
            </div>
          )}
        </div>
      </div>

      {readiness && readiness.reasons.length > 0 && (
        <div className="text-sm text-amber-900 bg-amber-50 border border-amber-200 px-3 py-2.5 rounded-xl">
          <strong>Ostrzeżenia:</strong>
          <ul className="list-disc list-inside mt-1">
            {readiness.reasons.map((r) => (
              <li key={r}>{r}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        <button
          onClick={refresh}
          disabled={busy}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-primary text-primary-foreground text-sm disabled:opacity-60"
        >
          {busy && <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />}
          Sprawdź połączenie
        </button>
        <button
          onClick={doCompare}
          disabled={busy || !readiness?.loggedIn}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-border text-sm disabled:opacity-60"
        >
          Porównaj dane
        </button>
        <button
          disabled={pushDisabled}
          title={pushDisabled ? "Wysyłanie jest wyłączone w tym wydaniu." : ""}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-border text-sm disabled:opacity-50"
        >
          Wyślij lokalne dane do chmury
        </button>
        <button
          disabled={pullDisabled}
          title={pullDisabled ? "Pobieranie jest wyłączone w tym wydaniu." : ""}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-border text-sm disabled:opacity-50"
        >
          Pobierz dane z chmury
        </button>
      </div>

      <p className="text-xs text-muted-foreground">
        Aplikacja działa lokalnie na tym urządzeniu. Automatyczna synchronizacja nie zostanie
        uruchomiona bez Twojej decyzji.
      </p>
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
