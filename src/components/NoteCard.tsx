import { Link } from "@tanstack/react-router";
import type { Note } from "@/lib/mock-data";
import { noteTypeLabel, simpleType } from "@/lib/mock-data";
import { formatDatePL } from "@/lib/utils";
import { Quote as QuoteIcon } from "lucide-react";

export function NoteCard({ note, bookId }: { note: Note; bookId: string }) {
  const t = simpleType(note.type);
  const preview = note.quoteText || note.content || note.comment || "";

  return (
    <Link
      to="/book/$id/notes/$noteId"
      params={{ id: bookId, noteId: note.id }}
      className="glass rounded-2xl p-4 block hover:bg-[var(--glass-inner)] transition"
    >
      <div className="flex items-center justify-between gap-2 mb-1.5">
        <span className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full bg-[var(--glass-inner)] gold-text">
          {noteTypeLabel(t)}
        </span>
        <span className="text-[11px] text-warm-muted">
          {formatDatePL(note.createdAt)}
          {note.pageNumber ? ` · str. ${note.pageNumber}` : ""}
        </span>
      </div>

      {note.title && <div className="font-serif text-base leading-snug mb-1">{note.title}</div>}

      {t === "chapter" && note.chapterNumber && (
        <div className="text-xs text-warm-muted mb-1">
          Rozdział {note.chapterNumber}
          {note.chapterTitle ? ` · ${note.chapterTitle}` : ""}
        </div>
      )}

      <div className="flex gap-3">
        {note.drawingDataUrl && (
          <img
            src={note.drawingDataUrl}
            alt="Notatka odręczna"
            className="w-20 h-16 rounded-lg object-cover shrink-0 bg-[var(--glass-inner)] border border-[var(--glass-border)]"
          />
        )}
        {!note.drawingDataUrl && note.photoUrl && (
          <img
            src={note.photoUrl}
            alt="Zdjęcie strony"
            className="w-16 h-16 rounded-lg object-cover shrink-0 border border-[var(--glass-border)]"
          />
        )}

        <div className="min-w-0 flex-1">
          {note.quoteText ? (
            <div className="flex gap-2 text-sm text-warm italic">
              <QuoteIcon className="w-3.5 h-3.5 gold-text shrink-0 mt-1" />
              <span className="line-clamp-3">{note.quoteText}</span>
            </div>
          ) : (
            preview && <div className="text-sm text-warm-muted line-clamp-3">{preview}</div>
          )}
        </div>
      </div>

      {note.updatedAt && (
        <div className="text-[10px] text-warm-muted mt-2 opacity-70">
          Zaktualizowano: {formatDatePL(note.updatedAt)}
        </div>
      )}
    </Link>
  );
}
