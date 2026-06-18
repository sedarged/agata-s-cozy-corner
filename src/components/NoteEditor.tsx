import { useEffect, useRef, useState } from "react";
import { useRouter } from "@tanstack/react-router";
import { BookStrip, NotesHeader } from "@/components/NotesShared";
import { HandwritingCanvas, type HandwritingCanvasHandle } from "@/components/HandwritingCanvas";
import type { Book, Note, NoteBackground, NoteInputMode, SimpleNoteType } from "@/lib/mock-data";
import { simpleType } from "@/lib/mock-data";
import { createNote, updateNote, deleteNote } from "@/lib/notes-store";
import {
  compressImageFile,
  getNoteDraft,
  setNoteDraft,
  clearNoteDraft,
} from "@/lib/book-workspace-store";
import { ImagePlus, X, Trash2 } from "lucide-react";

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
  const isNew = !existingNoteId;

  const [noteType, setNoteType] = useState<SimpleNoteType>(
    initial ? (simpleType(initial.type ?? "other")) : initialType,
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
  const [photoBaseline, setPhotoBaseline] = useState<string | undefined>(initial?.photoUrl);
  const [drawingBaseline, setDrawingBaseline] = useState<string | undefined>(initial?.drawingDataUrl);
  const [initialDrawingForCanvas, setInitialDrawingForCanvas] = useState<string | undefined>(initial?.drawingDataUrl);

  const [error, setError] = useState<string | null>(null);
  const [showLeave, setShowLeave] = useState<null | (() => void)>(null);
  const [showDelete, setShowDelete] = useState(false);
  const [draftPrompt, setDraftPrompt] = useState(false);
  const [photoBusy, setPhotoBusy] = useState(false);

  const canvasRef = useRef<HandwritingCanvasHandle>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const dirtyRef = useRef(false);

  // ---- draft recovery for NEW notes only ----
  useEffect(() => {
    if (!isNew) return;
    const d = getNoteDraft(book.id);
    if (d) setDraftPrompt(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const applyDraft = () => {
    const d = getNoteDraft(book.id);
    if (!d) { setDraftPrompt(false); return; }
    if (d.type) setNoteType((d.type as SimpleNoteType) ?? "other");
    if (d.inputMode) setMode(d.inputMode as NoteInputMode);
    setTitleVal(d.title ?? "");
    setContent(d.content ?? "");
    setQuoteText(d.quoteText ?? "");
    setChapter(d.chapter ?? "");
    setPageNumber(d.pageNumber ?? "");
    setPhotoUrl(d.photoUrl);
    if (d.drawingBackground) setBackground(d.drawingBackground as NoteBackground);
    if (d.drawingDataUrl) setInitialDrawingForCanvas(d.drawingDataUrl);
    setDraftPrompt(false);
  };
  const discardDraft = () => { clearNoteDraft(book.id); setDraftPrompt(false); };

  // ---- dirty tracking ----
  // Skip the initial render so opening the editor doesn't immediately mark it dirty.
  const initializedRef = useRef(false);
  const markDirty = () => { dirtyRef.current = true; };
  useEffect(() => {
    if (!initializedRef.current) { initializedRef.current = true; return; }
    dirtyRef.current = true;
  }, [titleVal, content, quoteText, chapter, pageNumber, noteType, mode, photoUrl, background]);

  // ---- autosave draft (new notes only, debounced) ----
  useEffect(() => {
    if (!isNew) return;
    const t = setTimeout(() => {
      if (!dirtyRef.current) return;
      const drawingDataUrl = mode === "handwriting" && canvasRef.current && canvasRef.current.hasInk()
        ? canvasRef.current.toDataUrl()
        : undefined;
      setNoteDraft(book.id, {
        type: noteType,
        inputMode: mode,
        title: titleVal,
        content,
        quoteText,
        chapter,
        pageNumber,
        photoUrl,
        drawingDataUrl,
        drawingBackground: background,
        savedAt: new Date().toISOString(),
      });
    }, 600);
    return () => clearTimeout(t);
  }, [isNew, book.id, noteType, mode, titleVal, content, quoteText, chapter, pageNumber, photoUrl, background]);

  // ---- beforeunload guard ----
  useEffect(() => {
    const onBefore = (e: BeforeUnloadEvent) => {
      if (!dirtyRef.current) return;
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", onBefore);
    return () => window.removeEventListener("beforeunload", onBefore);
  }, []);

  const onPickPhoto = async (file: File | undefined) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setError("Nie udało się dodać zdjęcia. Spróbuj wybrać mniejszy plik.");
      return;
    }
    setPhotoBusy(true);
    setError(null);
    try {
      const { dataUrl } = await compressImageFile(file);
      setPhotoUrl(dataUrl);
    } catch {
      setError("Nie udało się dodać zdjęcia. Spróbuj wybrać mniejszy plik.");
    } finally {
      setPhotoBusy(false);
    }
  };
  // Programmatic state changes above already mark dirty via the effect; nothing more to wire here.
  void markDirty;

  const removePhoto = () => {
    setPhotoUrl(undefined);
    if (fileRef.current) fileRef.current.value = "";
  };

  const onSave = () => {
    setError(null);
    let drawingDataUrl: string | undefined = drawingBaseline;
    let handwritingHasInk = false;
    if (mode === "handwriting" && canvasRef.current) {
      handwritingHasInk = canvasRef.current.hasInk();
      if (handwritingHasInk) {
        const url = canvasRef.current.toDataUrl();
        drawingDataUrl = url || drawingBaseline;
      } else {
        // Canvas cleared / never drawn → drop any previous drawing.
        drawingDataUrl = undefined;
      }
    }

    const pageN = pageNumber ? Number(pageNumber) : undefined;
    const chapterN = chapter ? Number(chapter) : undefined;

    const hasContent =
      Boolean(titleVal.trim()) ||
      Boolean(content.trim()) ||
      Boolean(quoteText.trim()) ||
      Boolean(photoUrl) ||
      (mode === "handwriting" && handwritingHasInk);

    if (!hasContent) {
      setError("Dodaj treść, cytat, zdjęcie albo pismo ręczne przed zapisaniem.");
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
      drawingDataUrl: mode === "handwriting" ? drawingDataUrl : drawingBaseline,
      drawingBackground: mode === "handwriting" ? background : initial?.drawingBackground,
    };

    const res = existingNoteId
      ? updateNote(existingNoteId, payload)
      : createNote({ bookId: book.id, ...payload });

    if (!res.ok) {
      setError(res.quota
        ? "Brak miejsca na zapisanie tej notatki na tym urządzeniu. Usuń większe zdjęcie albo wybierz mniejszy plik."
        : "Nie udało się zapisać notatki.");
      return;
    }

    dirtyRef.current = false;
    setPhotoBaseline(photoUrl);
    setDrawingBaseline(drawingDataUrl);
    if (isNew) clearNoteDraft(book.id);
    router.navigate({ to: categoryPath(noteType), params: { id: book.id } });
  };

  const tryLeave = (fn: () => void) => {
    if (dirtyRef.current) { setShowLeave(() => fn); return; }
    fn();
  };

  const onCancel = () => tryLeave(() => router.navigate({ to: "/book/$id/notes", params: { id: book.id } }));

  const onDelete = () => {
    if (!existingNoteId) return;
    deleteNote(existingNoteId);
    dirtyRef.current = false;
    setShowDelete(false);
    router.navigate({ to: categoryPath(noteType), params: { id: book.id } });
  };

  // Avoid hint about unused baseline state
  void photoBaseline;

  return (
    <div className="px-4 sm:px-6 lg:px-10 pb-20">
      <NotesHeader id={book.id} title={title} />
      <BookStrip book={book} />

      {draftPrompt && (
        <div className="glass rounded-2xl p-4 mt-4 flex items-center justify-between gap-3 flex-wrap">
          <div className="text-sm text-warm font-serif">Znaleziono niezapisaną notatkę</div>
          <div className="flex gap-2">
            <button onClick={applyDraft} className="px-3 py-1.5 rounded-full bg-[var(--accent-gold)] text-[var(--bg)] text-xs">Przywróć</button>
            <button onClick={discardDraft} className="px-3 py-1.5 rounded-full bg-[var(--glass-inner)] text-warm text-xs">Usuń szkic</button>
          </div>
        </div>
      )}

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
          <button key={o.value} type="button" onClick={() => {
            if (o.value === mode) return;
            // Snapshot strokes before unmounting the canvas so they survive a round-trip.
            if (mode === "handwriting" && canvasRef.current) {
              const snap = canvasRef.current.toDataUrl();
              if (snap) setInitialDrawingForCanvas(snap);
            }
            setMode(o.value);
          }}
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
          <div className="mt-2 flex items-start gap-3 flex-wrap">
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
                <button type="button" onClick={removePhoto}
                  className="absolute -top-2 -right-2 w-7 h-7 rounded-full bg-[var(--glass-inner)] border border-[var(--glass-border)] grid place-items-center text-warm"
                  aria-label="Usuń zdjęcie">
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            ) : (
              <button type="button" onClick={() => fileRef.current?.click()}
                disabled={photoBusy}
                className="inline-flex items-center gap-2 px-3 py-2 rounded-full bg-[var(--glass-inner)] text-warm text-xs disabled:opacity-60">
                <ImagePlus className="w-3.5 h-3.5 gold-text" /> {photoBusy ? "Przetwarzanie…" : "Dodaj zdjęcie"}
              </button>
            )}
            {photoUrl && (
              <button type="button" onClick={removePhoto}
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
            initialDataUrl={initialDrawingForCanvas}
            minHeight={typeof window !== "undefined" && window.innerWidth >= 768 ? 650 : 420}
            onDirty={() => { dirtyRef.current = true; }}
          />
        </div>
      )}

      {error && (
        <div className="mt-3 text-xs text-[var(--accent-gold)]">{error}</div>
      )}

      <div className="flex gap-3 mt-5 flex-wrap">
        <button type="button" onClick={onSave}
          className="flex-1 min-w-[140px] py-3 rounded-full bg-[var(--accent-gold)] text-[var(--bg)] text-sm font-medium">
          Zapisz
        </button>
        <button type="button" onClick={onCancel}
          className="flex-1 min-w-[120px] py-3 rounded-full glass text-warm text-sm">
          Anuluj
        </button>
        {existingNoteId && (
          <button type="button" onClick={() => setShowDelete(true)}
            className="py-3 px-5 rounded-full glass text-warm text-sm inline-flex items-center gap-2">
            <Trash2 className="w-4 h-4" /> Usuń notatkę
          </button>
        )}
      </div>

      {showLeave && (
        <ConfirmModal
          title="Opuścić bez zapisywania?"
          body="Masz niezapisane zmiany w tej notatce."
          confirmLabel="Opuść"
          cancelLabel="Zostań"
          onConfirm={() => { const fn = showLeave; setShowLeave(null); dirtyRef.current = false; fn(); }}
          onCancel={() => setShowLeave(null)}
        />
      )}
      {showDelete && (
        <ConfirmModal
          title="Usunąć notatkę?"
          body="Ta notatka zostanie usunięta tylko z tego urządzenia."
          confirmLabel="Usuń"
          cancelLabel="Anuluj"
          onConfirm={onDelete}
          onCancel={() => setShowDelete(false)}
        />
      )}
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

function ConfirmModal({
  title, body, confirmLabel, cancelLabel, onConfirm, onCancel,
}: {
  title: string; body: string; confirmLabel: string; cancelLabel: string;
  onConfirm: () => void; onCancel: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4">
      <div className="glass rounded-2xl p-6 max-w-sm w-full">
        <h3 className="font-serif text-lg mb-2">{title}</h3>
        <p className="text-sm text-warm-muted mb-5">{body}</p>
        <div className="flex gap-2 justify-end">
          <button onClick={onCancel} className="px-4 py-2 rounded-full bg-[var(--glass-inner)] text-warm text-sm">{cancelLabel}</button>
          <button onClick={onConfirm} className="px-4 py-2 rounded-full bg-[var(--accent-gold)] text-[var(--bg)] text-sm font-medium">{confirmLabel}</button>
        </div>
      </div>
    </div>
  );
}
