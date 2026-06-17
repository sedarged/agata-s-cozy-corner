import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/PageHeader";
import { useState } from "react";
import { Lock } from "lucide-react";

export const Route = createFileRoute("/settings")({
  head: () => ({ meta: [{ title: "Settings — Agata" }] }),
  component: Settings,
});

const sections = ["Account","Privacy & Gigi access","Themes","Data export","Backup & notes","Default book status","Default note style","Manage tags","Storage","About Agata"];
const gigiOptions = ["Off","Current book only","Selected notes only","Full library","Full library + conversations"];

function Settings() {
  const [section, setSection] = useState(sections[1]);
  const [gigi, setGigi] = useState("Full library + conversations");

  return (
    <div>
      <PageHeader title="Settings" subtitle="Your space, your rules."/>
      <div className="px-5 lg:px-10 grid lg:grid-cols-[260px_1fr] gap-6 pb-12 max-w-5xl">
        <nav className="bg-card rounded-3xl p-3 shadow-soft h-fit">
          {sections.map(s => (
            <button key={s} onClick={() => setSection(s)} className={`w-full text-left px-3 py-2.5 rounded-xl text-sm ${section === s ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}>{s}</button>
          ))}
          <button className="w-full text-left px-3 py-2.5 rounded-xl text-sm text-destructive hover:bg-muted">Sign out</button>
        </nav>

        <div className="bg-card rounded-3xl p-6 shadow-soft">
          <h2 className="font-serif text-2xl mb-1">{section}</h2>
          {section === "Privacy & Gigi access" && (
            <>
              <p className="text-sm text-muted-foreground">Choose how much Gigi can access in your library.</p>
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
                <div>Everything is private. Only you can see your data — no public profiles, no social feed, no ads.</div>
              </div>
            </>
          )}
          {section !== "Privacy & Gigi access" && (
            <p className="text-sm text-muted-foreground mt-2">Configure {section.toLowerCase()} here. This is a prototype — full settings will be wired to your account.</p>
          )}
        </div>
      </div>
    </div>
  );
}
