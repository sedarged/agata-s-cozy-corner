import { useRef, useState } from "react";
import { useRouter } from "@tanstack/react-router";
import { BookStrip, NotesHeader } from "@/components/NotesShared";
import { HandwritingCanvas, type HandwritingCanvasHandle } from "@/components/HandwritingCanvas";
import type { Book, Note, NoteBackground, NoteInputMode, SimpleNoteType } from "@/lib/mock-data";
import { createNote, updateNote } from "@/lib/notes-store";
import { ImagePlus, X } from "lucide-react";

interface Props {
  book: Book;
  title: string;
  initialType?: SimpleNoteType;
  initial?: Partial<Note>;
  existingNoteId?: string;
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

const categoryPath = (t: SimpleNoteType) =>
  t === "quote" ? "/book/$id/notes/quotes" : t === "chapter" ? "/book/$id/notes/chapters" : "/book/$id/notes/other";

export function NoteEditor({ book, title, initialType = "other", initial, existingNoteId }: Props) {
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
  const [chapter, setChapter] = useState(initial?.chapterNumber ? String(initial.chapterNumber) : "");
  const [pageNumber, setPageNumber] = useState(initial?.pageNumber ? String(initial.pageNumber) : "");
  const [background, setBackground] = useState<NoteBackground>(initial?.drawingBackground ?? "plain");
  const [photoUrl, setPhotoUrl] = useState<string | undefined>(initial?.photoUrl);
  const [error, setError] = useState<string | null>(null);
  const canvasRef = useRef<HandwritingCanvasHandle>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const onPickPhoto = (file: File | undefined) => {
    if (!file || !file.type.startsWith("image/")) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") setPhotoUrl(reader.result);
    };
    reader.readAsDataURL(file);
  };

  const onSave = () => {
    let drawingDataUrl: string | undefined = initial?.drawingDataUrl;
    if (mode === "handwriting" && canvasRef.current) {
      const url = canvasRef.current.toDataUrl();
      if (url) drawingDataUrl = url;
    }

    const pageN = pageNumber ? Number(pageNumber) : undefined;
    const chapterN = chapter ? Number(chapter) : undefined;

    const hasContent =
      Boolean(titleVal.trim()) ||
      Boolean(content.trim()) ||
      Boolean(quoteText.trim()) ||
      Boolean(photoUrl) ||
      (mode === "handwriting" && Boolean(drawingDataUrl));

    if (!hasContent) {
      setError("Dodaj treść, cytat, zdjęcie lub rysunek przed zapisaniem.");
      return;
    }

    const noteTypeForData: Note["type"] =
      noteType === "quote" ? "quote" : noteType === "chapter" ? "chapter" : "other";

    const payload = {
      type: noteTypeForData,
      title: titleVal.trim() || undefined,
      content: content.trim(),
      quoteText: quoteText.trim() || undefined,
      pageNumber: pageN,
      chapterNumber: chapterN,
      photoUrl,
      inputMode: mode,
      drawingDataUrl: mode === "handwriting" ? drawingDataUrl : initial?.drawingDataUrl,
      drawingBackground: mode === "handwriting" ? background : initial?.drawingBackground,
    };

    if (existingNoteId) {
      updateNote(existingNoteId, payload);
    } else {
      createNote({ bookId: book.id, ...payload });
    }

    router.navigate({ to: categoryPath(noteType), params: { id: book.id } });
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
            <input value={chapter} onChange={e => setChapter(e.target.value.replace(/[^0-9]/g, ""))}
              inputMode="numeric"
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

        <div>
          <span className="text-[11px] uppercase tracking-wider text-warm-muted">Zdjęcie strony</span>
          <div className="mt-2 flex items-start gap-3">
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={e => onPickPhoto(e.target.files?.[0])}
            />
            {photoUrl ? (
              <div className="relative">
                <img src={photoUrl} alt="Zdjęcie strony" className="w-28 h-28 rounded-xl object-cover border border-[var(--glass-border)]" />
                <button type="button" onClick={() => { setPhotoUrl(undefined); if (fileRef.current) fileRef.current.value = ""; }}
                  className="absolute -top-2 -right-2 w-7 h-7 rounded-full bg-[var(--glass-inner)] border border-[var(--glass-border)] grid place-items-center text-warm"
                  aria-label="Usuń zdjęcie">
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            ) : (
              <button type="button" onClick={() => fileRef.current?.click()}
                className="inline-flex items-center gap-2 px-3 py-2 rounded-full bg-[var(--glass-inner)] text-warm text-xs">
                <ImagePlus className="w-3.5 h-3.5 gold-text" /> Dodaj zdjęcie
              </button>
            )}
            {photoUrl && (
              <button type="button" onClick={() => { setPhotoUrl(undefined); if (fileRef.current) fileRef.current.value = ""; }}
                className="inline-flex items-center gap-2 px-3 py-2 rounded-full bg-[var(--glass-inner)] text-warm text-xs self-center">
                Usuń zdjęcie
              </button>
            )}
          </div>
        </div>
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

      {error && (
        <div className="mt-3 text-xs text-[var(--accent-gold)]">{error}</div>
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
