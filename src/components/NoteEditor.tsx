import { useRef, useState } from "react";
import { useRouter } from "@tanstack/react-router";
import { BookStrip, NotesHeader } from "@/components/NotesShared";
import { HandwritingCanvas, type HandwritingCanvasHandle } from "@/components/HandwritingCanvas";
import type { Book, Note, NoteBackground, NoteInputMode, SimpleNoteType } from "@/lib/mock-data";

interface Props {
  book: Book;
  title: string;
  initialType?: SimpleNoteType;
  initial?: Partial<Note>;
}

const typeOptions: { value: SimpleNoteType; label: string }[] = [
  { value: "quote", label: "Cytat" },
  { value: "chapter", label: "Rozdział" },
  { value: "other", label: "Inne" },
];

const modeOptions: { value: NoteInputMode; label: string }[] = [
  { value: "text", label: "Tekst" },
  { value: "handwriting", label: "Pismo ręczne" },
];

export function NoteEditor({ book, title, initialType = "other", initial }: Props) {
  const router = useRouter();
  const [noteType, setNoteType] = useState<SimpleNoteType>(
    initial ? ((initial.type === "quote" || initial.type === "chapter") ? initial.type : "other") : initialType,
  );
  const [mode, setMode] = useState<NoteInputMode>(
    initial?.inputMode ?? (initial?.drawingDataUrl ? "handwriting" : "text"),
  );
  const [titleVal, setTitleVal] = useState(initial?.title ?? "");
  const [content, setContent] = useState(initial?.content ?? "");
  const [quoteText, setQuoteText] = useState(initial?.quoteText ?? "");
  const [chapter, setChapter] = useState(
    initial?.chapterNumber ? String(initial.chapterNumber) : "",
  );
  const [pageNumber, setPageNumber] = useState(
    initial?.pageNumber ? String(initial.pageNumber) : "",
  );
  const [background, setBackground] = useState<NoteBackground>(initial?.drawingBackground ?? "plain");
  const canvasRef = useRef<HandwritingCanvasHandle>(null);

  const onSave = () => {
    // local/mock save
    if (mode === "handwriting" && canvasRef.current) {
      // capture data url (not persisted yet)
      canvasRef.current.toDataUrl();
    }
    router.navigate({ to: "/book/$id/notes", params: { id: book.id } });
  };
  const onCancel = () => {
    router.navigate({ to: "/book/$id/notes", params: { id: book.id } });
  };

  return (
    <div className="px-4 sm:px-6 lg:px-10 pb-20">
      <NotesHeader id={book.id} title={title} />
      <BookStrip book={book} />

      <div className="glass rounded-2xl p-3 mt-4 flex flex-wrap gap-2">
        <span className="text-xs text-warm-muted self-center pr-1">Typ</span>
        {typeOptions.map(o => (
          <button key={o.value} type="button" onClick={() => setNoteType(o.value)}
            className={`px-3 py-1.5 rounded-full text-xs ${noteType === o.value ? "bg-[var(--accent-gold)] text-[var(--bg)]" : "bg-[var(--glass-inner)] text-warm"}`}>
            {o.label}
          </button>
        ))}
      </div>

      <div className="glass rounded-2xl p-3 mt-3 flex flex-wrap gap-2">
        <span className="text-xs text-warm-muted self-center pr-1">Tryb</span>
        {modeOptions.map(o => (
          <button key={o.value} type="button" onClick={() => setMode(o.value)}
            className={`px-3 py-1.5 rounded-full text-xs ${mode === o.value ? "bg-[var(--accent-gold)] text-[var(--bg)]" : "bg-[var(--glass-inner)] text-warm"}`}>
            {o.label}
          </button>
        ))}
      </div>

      <div className="glass rounded-2xl p-4 mt-3 grid gap-3">
        <Field label="Tytuł notatki">
          <input value={titleVal} onChange={e => setTitleVal(e.target.value)}
            className="w-full bg-transparent border-b border-[var(--glass-border)] py-2 text-sm focus:outline-none focus:border-[var(--accent-gold)]" />
        </Field>

        {noteType === "quote" && (
          <Field label="Cytat">
            <textarea value={quoteText} onChange={e => setQuoteText(e.target.value)} rows={3}
              className="w-full bg-[var(--glass-inner)] rounded-xl p-3 text-sm italic focus:outline-none" />
          </Field>
        )}

        {noteType === "chapter" && (
          <Field label="Rozdział">
            <input value={chapter} onChange={e => setChapter(e.target.value)}
              className="w-full bg-transparent border-b border-[var(--glass-border)] py-2 text-sm focus:outline-none focus:border-[var(--accent-gold)]" />
          </Field>
        )}

        <Field label="Numer strony">
          <input inputMode="numeric" value={pageNumber} onChange={e => setPageNumber(e.target.value.replace(/[^0-9]/g, ""))}
            className="w-full bg-transparent border-b border-[var(--glass-border)] py-2 text-sm focus:outline-none focus:border-[var(--accent-gold)]" />
        </Field>

        {mode === "text" && (
          <Field label="Treść notatki">
            <textarea value={content} onChange={e => setContent(e.target.value)} rows={8}
              className="w-full bg-[var(--glass-inner)] rounded-xl p-3 text-sm focus:outline-none leading-relaxed" />
          </Field>
        )}
      </div>

      {mode === "handwriting" && (
        <div className="mt-3">
          <HandwritingCanvas
            ref={canvasRef}
            background={background}
            onBackgroundChange={setBackground}
            initialDataUrl={initial?.drawingDataUrl}
            minHeight={typeof window !== "undefined" && window.innerWidth >= 768 ? 650 : 420}
          />
        </div>
      )}

      <div className="flex gap-3 mt-5">
        <button type="button" onClick={onSave}
          className="flex-1 py-3 rounded-full bg-[var(--accent-gold)] text-[var(--bg)] text-sm font-medium">
          Zapisz
        </button>
        <button type="button" onClick={onCancel}
          className="flex-1 py-3 rounded-full glass text-warm text-sm">
          Anuluj
        </button>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-[11px] uppercase tracking-wider text-warm-muted">{label}</span>
      <div className="mt-1">{children}</div>
    </label>
  );
}
