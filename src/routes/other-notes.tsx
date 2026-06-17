import { createFileRoute, Link } from "@tanstack/react-router";
import { notes, books } from "@/lib/mock-data";
import { PageHeader } from "@/components/PageHeader";
import { ChevronRight, Plus } from "lucide-react";

export const Route = createFileRoute("/other-notes")({
  head: () => ({ meta: [{ title: "Other notes — Agata" }] }),
  component: Other,
});

function Other() {
  const others = notes.filter(n => n.type === "other");
  return (
    <div>
      <PageHeader title="Other notes" subtitle="Theories, character lists, reminders, loose thoughts."/>
      <div className="px-5 lg:px-10 max-w-3xl space-y-3 pb-12">
        {others.map(n => {
          const book = books.find(b => b.id === n.bookId)!;
          return (
            <Link to="/note/$id" params={{ id: n.id }} key={n.id} className="flex items-center gap-4 p-4 bg-card rounded-2xl shadow-soft hover:shadow-warm transition">
              <div className="flex-1 min-w-0">
                <div className="font-medium">{n.title}</div>
                <div className="text-xs text-muted-foreground line-clamp-1">{n.content}</div>
                <div className="text-[10px] text-muted-foreground mt-1">{book.title} · Updated {n.createdAt}</div>
              </div>
              <ChevronRight className="w-4 h-4 text-muted-foreground"/>
            </Link>
          );
        })}
        <Link to="/note/new?type=other" className="flex items-center justify-center gap-2 p-4 rounded-2xl border-2 border-dashed border-border text-muted-foreground hover:text-primary hover:border-primary"><Plus className="w-4 h-4"/>New note</Link>
      </div>
    </div>
  );
}
