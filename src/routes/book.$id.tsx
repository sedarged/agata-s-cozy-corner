import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useState } from "react";
import { books, getBookById, getNotesByBook } from "@/lib/mock-data";
import { BookCover } from "@/components/BookCover";
import { ArrowLeft, Heart, Star, BookOpen, Quote, FileText, Camera, Sparkles, Timer } from "lucide-react";

export const Route = createFileRoute("/book/$id")({
  loader: ({ params }) => {
    const book = getBookById(params.id);
    if (!book) throw notFound();
    return { book };
  },
  head: ({ loaderData }) => ({ meta: [{ title: `${loaderData?.book.title} — Agata` }, { name: "description", content: loaderData?.book.description?.slice(0, 160) }] }),
  notFoundComponent: () => <div className="p-10">Book not found.</div>,
  errorComponent: ({ error }) => <div className="p-10">{error.message}</div>,
  component: BookDetail,
});

const sections = ["Read", "About book", "My rating", "Notes", "Statistics", "Status"] as const;

function BookDetail() {
  const { book } = Route.useLoaderData();
  const [section, setSection] = useState<(typeof sections)[number]>("About book");
  const [fav, setFav] = useState(book.isFavourite);
  const bookNotes = getNotesByBook(book.id);
  const pct = Math.round((book.currentPage / book.pageCount) * 100);

  return (
    <div>
      <div className="px-5 lg:px-10 pt-8 flex items-center justify-between">
        <Link to="/library" className="p-2 -ml-2 rounded-full hover:bg-muted"><ArrowLeft className="w-5 h-5"/></Link>
        <button onClick={() => setFav(f => !f)} className="p-2 rounded-full hover:bg-muted">
          <Heart className={`w-5 h-5 ${fav ? "fill-rose text-rose" : "text-muted-foreground"}`}/>
        </button>
      </div>

      <div className="lg:grid lg:grid-cols-[1fr_320px] lg:gap-8 px-5 lg:px-10 pb-12">
        <div className="min-w-0">
          {/* Hero */}
          <div className="flex flex-col sm:flex-row gap-6 mt-2">
            <BookCover book={book} size="xl" className="mx-auto sm:mx-0"/>
            <div className="flex-1 min-w-0">
              <h1 className="font-serif text-3xl lg:text-4xl leading-tight">{book.title}</h1>
              <div className="text-lg text-muted-foreground mt-1">{book.author}</div>
              <div className="text-xs text-muted-foreground mt-1">{book.genre} · {book.publishedDate}</div>
              <div className="flex items-center gap-1 mt-3">
                {[...Array(5)].map((_,i) => <Star key={i} className={`w-4 h-4 ${i < Math.round((book.rating ?? 0)/2) ? "fill-rose text-rose" : "text-muted-foreground"}`}/>)}
                <span className="text-xs text-muted-foreground ml-2">{book.rating ? `${book.rating}/10` : "Not rated"} · Private</span>
              </div>
              <div className="mt-5">
                <div className="text-xs text-muted-foreground">Page {book.currentPage} of {book.pageCount} · {pct}%</div>
                <div className="mt-2 h-1.5 bg-muted rounded-full overflow-hidden">
                  <div className="h-full bg-primary" style={{ width: `${pct}%` }}/>
                </div>
              </div>

              {/* Quick actions */}
              <div className="grid grid-cols-5 gap-2 mt-6">
                {[
                  { icon: Timer, label: "Read", to: "/read" },
                  { icon: Quote, label: "Add quote", to: "/note/new?type=quote" },
                  { icon: FileText, label: "Add note", to: "/note/new?type=note" },
                  { icon: Camera, label: "Page photo", to: "/note/new?type=page-photo" },
                  { icon: Star, label: "Rate", to: "#rate" },
                ].map(a => (
                  <Link key={a.label} to={a.to as any} className="flex flex-col items-center gap-1 p-3 rounded-xl bg-card hover:bg-muted text-xs">
                    <a.icon className="w-4 h-4 text-primary"/>
                    <span className="text-[10px] text-center leading-tight">{a.label}</span>
                  </Link>
                ))}
              </div>
            </div>
          </div>

          {/* Section tabs */}
          <div className="mt-8 grid grid-cols-3 lg:grid-cols-6 gap-2">
            {sections.map(s => (
              <button key={s} onClick={() => setSection(s)} className={`p-3 rounded-xl text-xs font-medium transition ${section === s ? "bg-primary text-primary-foreground" : "bg-card text-foreground hover:bg-muted"}`}>
                {s}
              </button>
            ))}
          </div>

          {/* Section content */}
          <div className="mt-6 bg-card rounded-3xl p-6 shadow-soft min-h-[280px]">
            {section === "About book" && (
              <>
                <h3 className="font-serif text-xl mb-3">About book</h3>
                <p className="text-sm leading-relaxed">{book.description}</p>
                <dl className="grid grid-cols-2 gap-3 mt-5 text-sm">
                  <div><dt className="text-[10px] uppercase tracking-widest text-muted-foreground">Author</dt><dd>{book.author}</dd></div>
                  <div><dt className="text-[10px] uppercase tracking-widest text-muted-foreground">Published</dt><dd>{book.publishedDate}</dd></div>
                  <div><dt className="text-[10px] uppercase tracking-widest text-muted-foreground">Pages</dt><dd>{book.pageCount}</dd></div>
                  <div><dt className="text-[10px] uppercase tracking-widest text-muted-foreground">Genre</dt><dd>{book.genre}</dd></div>
                  <div><dt className="text-[10px] uppercase tracking-widest text-muted-foreground">ISBN</dt><dd>{book.isbn}</dd></div>
                  <div><dt className="text-[10px] uppercase tracking-widest text-muted-foreground">Format</dt><dd>Paperback</dd></div>
                </dl>
              </>
            )}
            {section === "Read" && (
              <div className="text-center py-8">
                <Timer className="w-10 h-10 mx-auto text-primary mb-3"/>
                <h3 className="font-serif text-xl">Start a focused reading session</h3>
                <p className="text-sm text-muted-foreground mt-1">Timer, page tracking and inline notes.</p>
                <Link to="/read" className="inline-block mt-5 px-5 py-2.5 rounded-full bg-primary text-primary-foreground text-sm">Open reading mode</Link>
              </div>
            )}
            {section === "My rating" && (
              <>
                <h3 className="font-serif text-xl mb-3">My rating · private</h3>
                {[
                  { l: "Overall", v: book.rating ?? 8 },
                  { l: "Writing style", v: 9 },
                  { l: "Emotional impact", v: 9 },
                  { l: "Usefulness", v: 6 },
                ].map(r => (
                  <div key={r.l} className="mt-3">
                    <div className="flex justify-between text-sm"><span>{r.l}</span><span className="text-muted-foreground">{r.v}/10</span></div>
                    <div className="mt-1 h-1.5 bg-muted rounded-full overflow-hidden"><div className="h-full bg-primary" style={{ width: `${r.v*10}%` }}/></div>
                  </div>
                ))}
                <div className="mt-5 flex items-center gap-2 text-sm"><input type="checkbox" defaultChecked className="rounded"/> Would read again</div>
                <textarea defaultValue="The world-building hooked me from page one. I felt every choice Violet made — that's rare." className="mt-3 w-full bg-muted rounded-xl p-3 text-sm min-h-24"/>
              </>
            )}
            {section === "Notes" && (
              <>
                <h3 className="font-serif text-xl mb-3">Notes on this book</h3>
                <div className="space-y-2">
                  {bookNotes.map(n => (
                    <Link key={n.id} to="/note/$id" params={{ id: n.id }} className="block p-3 rounded-xl bg-muted hover:bg-accent transition">
                      <div className="text-[10px] uppercase tracking-widest text-muted-foreground">{n.type} {n.pageNumber && `· p. ${n.pageNumber}`}</div>
                      <div className="text-sm mt-1 line-clamp-2">{n.quoteText ?? n.content ?? n.title}</div>
                    </Link>
                  ))}
                </div>
              </>
            )}
            {section === "Statistics" && (
              <>
                <h3 className="font-serif text-xl mb-3">Reading statistics</h3>
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { l: "Time spent", v: "12h 42m" },
                    { l: "Pages read", v: book.currentPage },
                    { l: "Sessions", v: 18 },
                    { l: "Notes", v: bookNotes.length },
                    { l: "Quotes", v: bookNotes.filter(n=>n.type==="quote").length },
                    { l: "Page photos", v: bookNotes.filter(n=>n.type==="page-photo").length },
                  ].map(s => (
                    <div key={s.l} className="bg-muted rounded-xl p-4 text-center">
                      <div className="font-serif text-2xl">{s.v}</div>
                      <div className="text-[10px] uppercase tracking-widest text-muted-foreground mt-1">{s.l}</div>
                    </div>
                  ))}
                </div>
              </>
            )}
            {section === "Status" && (
              <>
                <h3 className="font-serif text-xl mb-3">Book status</h3>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {["Queue","Reading now","Paused","Dropped","Finished","Favourite"].map(s => (
                    <button key={s} className="p-3 rounded-xl bg-muted hover:bg-primary hover:text-primary-foreground transition text-sm">{s}</button>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>

        {/* iPad side panel */}
        <aside className="hidden lg:flex flex-col gap-4 sticky top-6 self-start">
          <div className="bg-card rounded-3xl p-5 shadow-soft">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-serif text-lg">Recent notes</h3>
              <Link to="/notes" className="text-xs text-primary">View all</Link>
            </div>
            <div className="space-y-2">
              {bookNotes.slice(0, 3).map(n => (
                <Link key={n.id} to="/note/$id" params={{ id: n.id }} className="block p-3 rounded-xl bg-muted hover:bg-accent">
                  <div className="text-[10px] uppercase tracking-widest text-muted-foreground">{n.type} {n.pageNumber && `· p. ${n.pageNumber}`}</div>
                  <div className="text-xs mt-1 line-clamp-2">{n.quoteText ?? n.content ?? n.title}</div>
                </Link>
              ))}
            </div>
          </div>
          <div className="bg-gradient-to-br from-accent/40 to-card rounded-3xl p-5 shadow-soft">
            <div className="flex items-center gap-2 mb-2"><Sparkles className="w-4 h-4 text-primary"/><h3 className="font-serif text-lg">Gigi</h3></div>
            <p className="text-xs text-muted-foreground">Ask me anything about this book.</p>
            <Link to="/gigi" className="mt-3 inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full bg-primary text-primary-foreground"><BookOpen className="w-3 h-3"/> Chat with Gigi</Link>
          </div>
        </aside>
      </div>
    </div>
  );
}
