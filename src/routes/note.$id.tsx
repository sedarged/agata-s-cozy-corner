import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useState } from "react";
import { notes, books } from "@/lib/mock-data";
import { ArrowLeft, Save, Sparkles, Star, Camera, Quote, FileText, ListTree, Image } from "lucide-react";

export const Route = createFileRoute("/note/$id")({
  loader: ({ params }) => {
    if (params.id === "new") return { isNew: true as const, note: null };
    const note = notes.find(n => n.id === params.id);
    if (!note) throw notFound();
    return { isNew: false as const, note };
  },
  head: () => ({ meta: [{ title: "Note — Agata" }] }),
  notFoundComponent: () => <div className="p-10">Note not found.</div>,
  errorComponent: ({ error }) => <div className="p-10">{error.message}</div>,
  component: NoteEditor,
});

const types = [
  { id: "quote", label: "Quote", icon: Quote },
  { id: "note", label: "Note", icon: FileText },
  { id: "page-photo", label: "Page photo", icon: Camera },
  { id: "chapter", label: "Chapter", icon: ListTree },
  { id: "other", label: "Other", icon: FileText },
] as const;

function NoteEditor() {
  const data = Route.useLoaderData();
  const note = data.note;
  const [type, setType] = useState<string>(note?.type ?? "quote");
  const [fav, setFav] = useState(note?.isFavourite ?? false);
  const book = note ? books.find(b => b.id === note.bookId) : books[0];

  return (
    <div>
      <div className="px-5 lg:px-10 pt-8 flex items-center justify-between">
        <Link to="/notes" className="p-2 -ml-2 rounded-full hover:bg-muted"><ArrowLeft className="w-5 h-5"/></Link>
        <div className="flex items-center gap-2">
          <button onClick={() => setFav((f: boolean) => !f)} className="p-2 rounded-full hover:bg-muted"><Star className={`w-5 h-5 ${fav ? "fill-rose text-rose" : "text-muted-foreground"}`}/></button>
          <button className="flex items-center gap-2 px-4 py-2 rounded-full bg-primary text-primary-foreground text-sm"><Save className="w-4 h-4"/>Save note</button>
        </div>
      </div>

      <div className="px-5 lg:px-10 mt-6 max-w-3xl pb-12">
        <h1 className="font-serif text-3xl mb-5">{data.isNew ? "New note" : "Edit note"}</h1>

        <div className="grid grid-cols-5 gap-2 mb-6">
          {types.map(t => (
            <button key={t.id} onClick={() => setType(t.id)} className={`flex flex-col items-center gap-1 p-3 rounded-xl text-xs ${type === t.id ? "bg-primary text-primary-foreground" : "bg-card hover:bg-muted"}`}>
              <t.icon className="w-4 h-4"/>{t.label}
            </button>
          ))}
        </div>

        <div className="space-y-4">
          <Field label="Book">
            <select defaultValue={book?.id} className="w-full bg-muted rounded-xl px-4 py-3 text-sm">
              {books.map(b => <option key={b.id} value={b.id}>{b.title} — {b.author}</option>)}
            </select>
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Page"><input defaultValue={note?.pageNumber ?? ""} type="number" className="w-full bg-muted rounded-xl px-4 py-3 text-sm"/></Field>
            <Field label="Chapter"><input defaultValue={note?.chapterNumber ?? ""} type="number" className="w-full bg-muted rounded-xl px-4 py-3 text-sm"/></Field>
          </div>
          {type === "quote" && (
            <Field label="Quote">
              <textarea defaultValue={note?.quoteText} className="w-full bg-muted rounded-xl px-4 py-3 text-sm min-h-32 font-serif italic"/>
            </Field>
          )}
          {type === "page-photo" && (
            <div className="aspect-[4/3] rounded-2xl bg-muted grid place-items-center text-muted-foreground">
              <div className="text-center"><Image className="w-8 h-8 mx-auto"/><div className="text-xs mt-2">Tap to add page photo</div></div>
            </div>
          )}
          <Field label="My comment">
            <textarea defaultValue={note?.content} className="w-full bg-muted rounded-xl px-4 py-3 text-sm min-h-24" placeholder="This hit me so hard. Need to remember…"/>
          </Field>
          <Field label="Tags">
            <input defaultValue={note?.tags.join(", ")} className="w-full bg-muted rounded-xl px-4 py-3 text-sm" placeholder="motivation, important, life"/>
          </Field>
          <div className="flex items-center justify-between p-4 bg-muted rounded-xl">
            <div className="text-sm">Mark as favourite</div>
            <button onClick={() => setFav((f: boolean) => !f)} className={`w-10 h-6 rounded-full transition relative ${fav ? "bg-primary" : "bg-card"}`}>
              <span className={`absolute top-0.5 ${fav ? "left-5" : "left-0.5"} w-5 h-5 rounded-full bg-background transition-all`}/>
            </button>
          </div>
          <div className="flex gap-2 pt-4">
            <button className="flex items-center gap-2 px-4 py-2 rounded-full bg-card border border-border text-sm"><Camera className="w-4 h-4"/>Add photo</button>
            <Link to="/gigi" className="flex items-center gap-2 px-4 py-2 rounded-full bg-card border border-border text-sm"><Sparkles className="w-4 h-4"/>Ask Gigi</Link>
            <Link to="/notebook" className="flex items-center gap-2 px-4 py-2 rounded-full bg-card border border-border text-sm">Open in notebook</Link>
          </div>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <div className="text-[10px] uppercase tracking-widest text-muted-foreground mb-1.5">{label}</div>
      {children}
    </label>
  );
}
