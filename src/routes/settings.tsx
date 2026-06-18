import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/PageHeader";
import { useState } from "react";
import { Lock } from "lucide-react";
import { DatabaseStatus } from "@/components/DatabaseStatus";
import { BackupPanel } from "@/components/BackupPanel";

export const Route = createFileRoute("/settings")({
  head: () => ({ meta: [{ title: "Ustawienia — Agata" }] }),
  component: Settings,
});

const sections = ["Konto","Prywatność i dostęp Gigi","Status bazy","Motywy","Kopia zapasowa","Domyślny status książki","Domyślny styl notatki","Zarządzaj tagami","Pamięć","O Agacie"];

const gigiOptions = ["Wyłączone","Tylko aktualna książka","Tylko wybrane notatki","Cała biblioteka","Cała biblioteka + rozmowy"];

function Settings() {
  const [section, setSection] = useState(sections[1]);
  const [gigi, setGigi] = useState("Cała biblioteka + rozmowy");

  return (
    <div>
      <PageHeader title="Ustawienia" subtitle="Twoja przestrzeń, Twoje zasady."/>
      <div className="px-5 lg:px-10 grid lg:grid-cols-[260px_1fr] gap-6 pb-12 max-w-5xl">
        <nav className="bg-card rounded-3xl p-3 shadow-soft h-fit">
          {sections.map(s => (
            <button key={s} onClick={() => setSection(s)} className={`w-full text-left px-3 py-2.5 rounded-xl text-sm ${section === s ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}>{s}</button>
          ))}
          <button className="w-full text-left px-3 py-2.5 rounded-xl text-sm text-destructive hover:bg-muted">Wyloguj</button>
        </nav>

        <div className="bg-card rounded-3xl p-6 shadow-soft">
          <h2 className="font-serif text-2xl mb-1">{section}</h2>
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
          {section !== "Prywatność i dostęp Gigi" && section !== "Status bazy" && section !== "Kopia zapasowa" && (
            <p className="text-sm text-muted-foreground mt-2">Skonfiguruj sekcję „{section.toLowerCase()}" tutaj. To prototyp — pełne ustawienia zostaną podpięte do Twojego konta.</p>
          )}
        </div>
      </div>
    </div>
  );
}
