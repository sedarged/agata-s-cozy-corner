import { createFileRoute, Link } from "@tanstack/react-router";
import { PageHeader } from "@/components/PageHeader";
import { ScanLine, Hash, BookOpen, User, PenLine, ChevronRight, ArrowLeft } from "lucide-react";

export const Route = createFileRoute("/add-book")({
  head: () => ({ meta: [{ title: "Dodaj książkę — Agata" }] }),
  component: AddBook,
});

function AddBook() {
  const options = [
    { to: "/search?mode=isbn-scan", icon: ScanLine, label: "Skanuj ISBN", desc: "Użyj aparatu, by zeskanować kod kreskowy" },
    { to: "/search?mode=isbn", icon: Hash, label: "Wpisz ISBN", desc: "Wpisz ISBN ręcznie" },
    { to: "/search", icon: BookOpen, label: "Szukaj po tytule", desc: "Znajdź książkę po tytule" },
    { to: "/search?mode=author", icon: User, label: "Szukaj po autorze", desc: "Znajdź książki po autorze" },
    { to: "/search?mode=manual", icon: PenLine, label: "Dodaj ręcznie", desc: "Utwórz książkę samodzielnie" },
  ];
  return (
    <div>
      <div className="px-5 lg:px-10 pt-8 flex items-center gap-3">
        <Link to="/library" className="p-2 -ml-2 rounded-full hover:bg-muted"><ArrowLeft className="w-5 h-5"/></Link>
      </div>
      <PageHeader title="Dodaj książkę" subtitle="Wybierz, jak chcesz dodać ją na swoją półkę." />
      <div className="px-5 lg:px-10 max-w-2xl space-y-3 pb-12">
        {options.map(o => (
          <Link key={o.to} to={o.to} className="flex items-center gap-4 p-5 rounded-2xl bg-card hover:bg-muted transition shadow-soft">
            <div className="w-12 h-12 rounded-xl bg-primary/10 text-primary grid place-items-center"><o.icon className="w-5 h-5"/></div>
            <div className="flex-1 min-w-0">
              <div className="font-medium">{o.label}</div>
              <div className="text-xs text-muted-foreground">{o.desc}</div>
            </div>
            <ChevronRight className="w-4 h-4 text-muted-foreground"/>
          </Link>
        ))}
      </div>
    </div>
  );
}
