import { createFileRoute, Link } from "@tanstack/react-router";
import { notes, books } from "@/lib/mock-data";
import { PageHeader } from "@/components/PageHeader";
import { BookOpen, Plus } from "lucide-react";

export const Route = createFileRoute("/chapters")({
  head: () => ({ meta: [{ title: "Notatki rozdziałów — Agata" }] }),
  component: Chapters,
});

function Chapters() {
  const chapters = notes.filter(n => n.type === "chapter");
  return (
    <div>
      <PageHeader title="Rozdziały" subtitle="Notatki uporządkowane po rozdziałach."/>
      <div className="px-5 lg:px-10 grid lg:grid-cols-2 gap-4 pb-12 max-w-5xl">
        {chapters.map(n => {
          const book = books.find(b => b.id === n.bookId)!;
          return (
            <Link to="/note/$id" params={{ id: n.id }} key={n.id} className="flex gap-4 p-5 bg-card rounded-2xl shadow-soft hover:shadow-warm transition">
              <div className="w-10 h-10 rounded-full bg-primary/10 text-primary grid place-items-center shrink-0"><BookOpen className="w-4 h-4"/></div>
              <div className="flex-1 min-w-0">
                <div className="flex items-baseline justify-between gap-3">
                  <div className="font-medium">Rozdział {n.chapterNumber}</div>
                  <div className="text-xs text-muted-foreground">{n.createdAt}</div>
                </div>
                <div className="text-sm text-muted-foreground line-clamp-2 mt-1">{n.chapterTitle && `${n.chapterTitle} · `}{n.content}</div>
                <div className="text-xs text-muted-foreground mt-2">{book.title}</div>
              </div>
            </Link>
          );
        })}
        <Link to="/note/new?type=chapter" className="flex items-center justify-center gap-2 p-5 rounded-2xl border-2 border-dashed border-border text-muted-foreground hover:text-primary hover:border-primary"><Plus className="w-4 h-4"/>Nowa notatka rozdziału</Link>
      </div>
    </div>
  );
}
