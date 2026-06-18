import { Link } from "@tanstack/react-router";
import { Plus, ExternalLink } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { BookStrip, NotesHeader } from "@/components/NotesShared";
import { NoteCard } from "@/components/NoteCard";
import { noteTypeLabel, simpleType, type SimpleNoteType } from "@/lib/mock-data";
import { getEffectiveBookById as getBookById } from "@/lib/books-store";
import { getNotesForBook, getNotesForBookByType, useNotesVersion } from "@/lib/notes-store";

interface Props {
  bookId: string;
  title: string;
  helper: string;
  filter: SimpleNoteType | "all";
  addLabel: string;
  newSearch?: { type?: SimpleNoteType };
  emptyTitle: string;
  emptyText: string;
}

export function NotesListPage({ bookId, title, helper, filter, addLabel, newSearch, emptyTitle, emptyText }: Props) {
  useNotesVersion();
  const book = getBookById(bookId);
  const notes = useMemo(() => {
    if (!book) return [];
    const arr = filter === "all" ? getNotesForBook(bookId) : getNotesForBookByType(bookId, filter);
    return [...arr].sort((a, b) => {
      const ak = a.updatedAt ?? a.createdAt;
      const bk = b.updatedAt ?? b.createdAt;
      return ak < bk ? 1 : -1;
    });
  }, [bookId, filter, book]);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = useMemo(
    () => notes.find((n) => n.id === selectedId) ?? notes[0] ?? null,
    [notes, selectedId],
  );

  // Keyboard ↑/↓ navigation between notes when split view is active (lg+).
  useEffect(() => {
    if (typeof window === "undefined" || notes.length === 0) return;
    const isLg = () => window.matchMedia("(min-width: 1024px)").matches;
    const onKey = (e: KeyboardEvent) => {
      if (!isLg()) return;
      const target = e.target as HTMLElement | null;
      if (target && /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName)) return;
      if (target?.isContentEditable) return;
      if (e.key !== "ArrowUp" && e.key !== "ArrowDown") return;
      e.preventDefault();
      const currentIndex = Math.max(0, notes.findIndex((n) => n.id === (selected?.id ?? "")));
      const nextIndex =
        e.key === "ArrowDown"
          ? Math.min(notes.length - 1, currentIndex + 1)
          : Math.max(0, currentIndex - 1);
      setSelectedId(notes[nextIndex].id);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [notes, selected?.id]);

  if (!book) {
    return (
      <div className="px-5 pt-16 text-center text-warm">
        <div className="glass rounded-[24px] p-8 max-w-md mx-auto">
          <h1 className="font-serif text-xl mb-2">Nie znaleziono książki</h1>
        </div>
      </div>
    );
  }

  return (
    <div className="px-4 sm:px-6 lg:px-10 pb-16">
      <NotesHeader id={bookId} title={title} />
      <BookStrip book={book} />
      <p className="text-sm text-warm-muted mt-3">{helper}</p>

      <Link
        to="/book/$id/notes/new"
        params={{ id: bookId }}
        search={newSearch ?? {}}
        className="mt-3 inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-[var(--accent-gold)] text-[var(--bg)] text-sm"
      >
        <Plus className="w-4 h-4" /> {addLabel}
      </Link>

      {notes.length === 0 ? (
        <div className="glass rounded-[24px] p-8 mt-6 text-center">
          <h2 className="font-serif text-lg mb-2">{emptyTitle}</h2>
          <p className="text-sm text-warm-muted mb-4">{emptyText}</p>
          <Link
            to="/book/$id/notes/new"
            params={{ id: bookId }}
            search={newSearch ?? {}}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[var(--accent-gold)] text-[var(--bg)] text-sm"
          >
            <Plus className="w-4 h-4" /> {addLabel}
          </Link>
        </div>
      ) : (
        <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
          <div className="grid gap-3 content-start">
            {notes.map((n) => (
              <div
                key={n.id}
                onClickCapture={(e) => {
                  if (window.matchMedia("(min-width: 1024px)").matches) {
                    e.preventDefault();
                    e.stopPropagation();
                    setSelectedId(n.id);
                  }
                }}
                className={
                  selected?.id === n.id
                    ? "lg:ring-2 lg:ring-[var(--accent-gold)] rounded-2xl"
                    : ""
                }
              >
                <NoteCard note={n} bookId={bookId} />
              </div>
            ))}
          </div>

          {selected && (
            <aside className="hidden lg:block">
              <div className="glass rounded-2xl p-6 sticky top-6">
                <div className="flex items-center justify-between gap-2 mb-3">
                  <span className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full bg-[var(--glass-inner)] gold-text">
                    {noteTypeLabel(simpleType(selected.type))}
                  </span>
                  <Link
                    to="/book/$id/notes/$noteId"
                    params={{ id: bookId, noteId: selected.id }}
                    className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full bg-[var(--accent-gold)] text-[var(--bg)]"
                  >
                    <ExternalLink className="w-3.5 h-3.5" /> Otwórz w edytorze
                  </Link>
                </div>
                {selected.title && (
                  <h3 className="font-serif text-xl mb-1 leading-snug">{selected.title}</h3>
                )}
                {selected.chapterNumber && (
                  <div className="text-xs text-warm-muted mb-2">
                    Rozdział {selected.chapterNumber}
                    {selected.chapterTitle ? ` · ${selected.chapterTitle}` : ""}
                  </div>
                )}
                {selected.pageNumber && (
                  <div className="text-xs text-warm-muted mb-2">str. {selected.pageNumber}</div>
                )}
                {selected.quoteText && (
                  <blockquote className="font-serif italic text-lg leading-relaxed border-l-2 border-[var(--accent-gold)] pl-4 my-3">
                    „{selected.quoteText}"
                  </blockquote>
                )}
                {selected.drawingDataUrl && (
                  <img
                    src={selected.drawingDataUrl}
                    alt="Notatka odręczna"
                    className="w-full rounded-xl border border-[var(--glass-border)] my-3"
                  />
                )}
                {selected.photoUrl && !selected.drawingDataUrl && (
                  <img
                    src={selected.photoUrl}
                    alt="Zdjęcie strony"
                    className="w-full rounded-xl border border-[var(--glass-border)] my-3"
                  />
                )}
                {selected.content && (
                  <p className="text-sm leading-relaxed whitespace-pre-wrap text-warm">
                    {selected.content}
                  </p>
                )}
                {selected.comment && (
                  <p className="text-sm leading-relaxed whitespace-pre-wrap text-warm-muted mt-3 italic">
                    {selected.comment}
                  </p>
                )}
                {selected.tags && selected.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-4">
                    {selected.tags.map((t) => (
                      <span
                        key={t}
                        className="text-[11px] px-2 py-0.5 rounded-full bg-[var(--glass-inner)] text-warm-muted"
                      >
                        #{t}
                      </span>
                    ))}
                  </div>
                )}
                <div className="text-[11px] text-warm-muted mt-4">
                  {selected.createdAt}
                  {selected.updatedAt ? ` · zmieniono ${selected.updatedAt}` : ""}
                </div>
              </div>
            </aside>
          )}
        </div>
      )}
    </div>
  );
}
