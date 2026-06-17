import type { ReactNode } from "react";

export function PageHeader({ title, subtitle, action }: { title: ReactNode; subtitle?: ReactNode; action?: ReactNode }) {
  return (
    <header className="px-5 lg:px-10 pt-8 lg:pt-10 pb-4 flex items-end justify-between gap-4">
      <div className="min-w-0">
        <h1 className="font-serif text-3xl lg:text-5xl">{title}</h1>
        {subtitle && <p className="text-sm text-muted-foreground mt-1">{subtitle}</p>}
      </div>
      {action}
    </header>
  );
}

export function Chips({ items, value, onChange }: { items: string[]; value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex gap-2 overflow-x-auto px-5 lg:px-10 pb-2 -mx-1 no-scrollbar">
      {items.map(i => (
        <button key={i} onClick={() => onChange(i)} className={`px-4 py-1.5 rounded-full text-sm whitespace-nowrap transition border ${value === i ? "bg-primary text-primary-foreground border-primary" : "bg-card text-foreground border-border hover:bg-muted"}`}>
          {i}
        </button>
      ))}
    </div>
  );
}
