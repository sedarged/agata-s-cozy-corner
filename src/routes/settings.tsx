import { createFileRoute, Link } from "@tanstack/react-router";
import { PageHeader } from "@/components/PageHeader";
import { useState } from "react";
import { Lock, ArrowRight, LogOut, UserRound } from "lucide-react";
import { DatabaseStatus } from "@/components/DatabaseStatus";
import { BackupPanel } from "@/components/BackupPanel";
import { GoalsPanel } from "@/components/GoalsPanel";
import { useAuth } from "@/lib/auth-context";

export const Route = createFileRoute("/settings")({
  head: () => ({ meta: [{ title: "Ustawienia — Agata" }] }),
  component: Settings,
});

const sections = ["Konto","Prywatność i dostęp Gigi","Status bazy","Motywy","Cele czytelnicze","Kopia zapasowa","Domyślny status książki","Domyślny styl notatki","Zarządzaj tagami","Pamięć","O Agacie"];

const gigiOptions = ["Wyłączone","Tylko aktualna książka","Tylko wybrane notatki","Cała biblioteka","Cała biblioteka + rozmowy"];

function Settings() {
  const [section, setSection] = useState(sections[0]);
  const [gigi, setGigi] = useState("Cała biblioteka + rozmowy");
  const { user, signOut } = useAuth();

  return (
    <div>
      <PageHeader title="Ustawienia" subtitle="Twoja przestrzeń, Twoje zasady."/>
      <div className="px-5 lg:px-10 grid lg:grid-cols-[260px_1fr] gap-6 pb-12 max-w-5xl">
        <nav className="bg-card rounded-3xl p-3 shadow-soft h-fit">
          {sections.map(s => (
            <button key={s} onClick={() => setSection(s)} className={`w-full text-left px-3 py-2.5 rounded-xl text-sm ${section === s ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}>{s}</button>
          ))}
          {user ? (
            <button onClick={() => signOut()} className="w-full text-left px-3 py-2.5 rounded-xl text-sm text-destructive hover:bg-muted flex items-center gap-2">
              <LogOut className="w-4 h-4" />
              Wyloguj
            </button>
          ) : (
            <Link to="/auth" className="w-full text-left px-3 py-2.5 rounded-xl text-sm text-primary hover:bg-muted flex items-center gap-2">
              <UserRound className="w-4 h-4" />
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
                  <button onClick={() => signOut()} className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-destructive text-destructive-foreground text-sm font-medium hover:opacity-90 transition-opacity">
                    <LogOut className="w-4 h-4" />
                    Wyloguj
                  </button>
                </div>
              ) : (
                <div className="space-y-5">
                  <p className="text-sm text-muted-foreground">Zaloguj się, aby synchronizować dane między urządzeniami i w przyszłości korzystać z Gigi.</p>
                  <Link to="/auth" className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition-opacity">
                    Zaloguj się
                    <ArrowRight className="w-4 h-4" />
                  </Link>
                </div>
              )}
            </>
          )}
          {section === "Prywatność i dostęp Gigi" && (
            <>
              <p className="text-sm text-muted-foreground">Wybierz, do czego Gigi ma dostęp w Twojej bibliotece.</p>
              <div className="mt-5 space-y-2">
                {gigiOptions.map(o => (
                  <button key={o} onClick={() => setGigi(o)} className={`w-full flex items-center justify-between p-4 rounded-xl border transition ${gigi === o ? "border-primary bg-primary/10" : "border-border hover:bg-muted"}`}>
                    <span className="text-sm">{o}</span>
                    <span className={`w-4 h-4 rounded-full border-2 ${gigi === o ? "border-primary bg-primary" : "border-border"}`}/>
                  </button>
                ))}
              </div>
              <div className="mt-6 flex items-start gap-2 p-4 rounded-xl bg-muted text-xs text-muted-foreground">
                <Lock className="w-4 h-4 mt-0.5"/>
                <div>Wszystko jest prywatne. Tylko Ty widzisz swoje dane — bez publicznych profili, feedu społecznościowego ani reklam.</div>
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
          {section !== "Prywatność i dostęp Gigi" && section !== "Status bazy" && section !== "Kopia zapasowa" && section !== "Cele czytelnicze" && (
            <p className="text-sm text-muted-foreground mt-2">Skonfiguruj sekcję „{section.toLowerCase()}" tutaj. To prototyp — pełne ustawienia zostaną podpięte do Twojego konta.</p>
          )}
        </div>
      </div>
    </div>
  );
}
