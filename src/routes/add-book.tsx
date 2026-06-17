import { createFileRoute, Link } from "@tanstack/react-router";
import { PageHeader } from "@/components/PageHeader";
import { ScanLine, Hash, BookOpen, User, PenLine, ChevronRight, ArrowLeft } from "lucide-react";

export const Route = createFileRoute("/add-book")({
  head: () => ({ meta: [{ title: "Add Book — Agata" }] }),
  component: AddBook,
});

function AddBook() {
  const options = [
    { to: "/search?mode=isbn-scan", icon: ScanLine, label: "Scan ISBN", desc: "Use your camera to scan the book barcode" },
    { to: "/search?mode=isbn", icon: Hash, label: "Enter ISBN", desc: "Type ISBN manually" },
    { to: "/search", icon: BookOpen, label: "Search by title", desc: "Find a book by title" },
    { to: "/search?mode=author", icon: User, label: "Search by author", desc: "Find books by author" },
    { to: "/search?mode=manual", icon: PenLine, label: "Add manually", desc: "Create a book yourself" },
  ];
  return (
    <div>
      <div className="px-5 lg:px-10 pt-8 flex items-center gap-3">
        <Link to="/library" className="p-2 -ml-2 rounded-full hover:bg-muted"><ArrowLeft className="w-5 h-5"/></Link>
      </div>
      <PageHeader title="Add book" subtitle="Choose how you'd like to add this one to your shelf." />
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
