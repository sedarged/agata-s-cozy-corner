import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "@tanstack/react-router";
import { BookStrip, NotesHeader } from "@/components/NotesShared";
import {
  HandwritingCanvas,
  getStoredHandwritingBackground,
  type HandwritingCanvasHandle,
} from "@/components/HandwritingCanvas";
import type { Book, Note, NoteBackground, NoteInputMode, SimpleNoteType } from "@/lib/mock-data";
import { simpleType } from "@/lib/mock-data";
import { createNote, updateNote, deleteNote, getNotesForBook } from "@/lib/notes-store";
import { getDefaultNoteMode } from "@/lib/preferences";
import {
  compressImageFile,
  getNoteDraft,
  setNoteDraft,
  clearNoteDraft,
} from "@/lib/book-workspace-store";
import {
  ImagePlus,
  X,
  Trash2,
  Type,
  PenLine,
  Plus,
  Quote,
  BookOpen,
  Sparkles,
  Heart,
} from "lucide-react";

interface Props {
  book: Book;
  title: string;
  initialType?: SimpleNoteType;
  initial?: Partial<Note>;
  existingNoteId?: string;
}

const typeOptions: { value: SimpleNoteType; label: string; icon: typeof Quote }[] = [
  { value: "quote", label: "Cytat", icon: Quote },
  { value: "chapter", label: "Rozdział", icon: BookOpen },
  { value: "other", label: "Inne", icon: Sparkles },
];

const categoryPath = (t: SimpleNoteType) =>
  t === "quote"
    ? "/book/$id/notes/quotes"
    : t === "chapter"
      ? "/book/$id/notes/chapters"
      : "/book/$id/notes/other";

function noteTabLabel(n: Note): string {
  if (n.title?.trim()) return n.title.trim();
  if (n.quoteText?.trim()) return `„${n.quoteText.trim().slice(0, 24)}…”`;
  if (n.chapterTitle?.trim()) return n.chapterTitle.trim();
  if (n.chapterNumber) return `Rozdział ${n.chapterNumber}`;
  if (n.content?.trim()) return n.content.trim().slice(0, 28);
  return "Bez tytułu";
}

export function NoteEditor({ book, title, initialType = "other", initial, existingNoteId }: Props) {
  const router = useRouter();
  const isNew = !existingNoteId;

  const [noteType, setNoteType] = useState<SimpleNoteType>(
    initial ? simpleType(initial.type ?? "other") : initialType,
  );
  const [mode, setMode] = useState<NoteInputMode>(
    // Existing notes honour their saved inputMode; legacy notes with a drawing
    // default to handwriting. New notes use the user's preferred default style
    // (Settings → "Domyślny styl notatki"; handwriting / iPad-pen first by default).
    initial?.inputMode ??
      (initial?.drawingDataUrl ? "handwriting" : isNew ? getDefaultNoteMode() : "text"),
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
  const [background, setBackground] = useState<NoteBackground>(
    initial?.drawingBackground ?? getStoredHandwritingBackground() ?? "plain",
  );
  const [photoUrl, setPhotoUrl] = useState<string | undefined>(initial?.photoUrl);
  const [drawingBaseline, setDrawingBaseline] = useState<string | undefined>(
    initial?.drawingDataUrl,
  );
  const [initialDrawingForCanvas, setInitialDrawingForCanvas] = useState<string | undefined>(
    initial?.drawingDataUrl,
  );
  const [chapterTitle, setChapterTitle] = useState<string>(initial?.chapterTitle ?? "");
  const [tags, setTags] = useState<string[]>(initial?.tags ?? []);
  const [tagInput, setTagInput] = useState("");
  const [isFavourite, setIsFavourite] = useState(initial?.isFavourite ?? false);

  const [error, setError] = useState<string | null>(null);
  const [showLeave, setShowLeave] = useState<null | (() => void)>(null);
  const [showDelete, setShowDelete] = useState(false);
  const [draftPrompt, setDraftPrompt] = useState(false);
  const [photoBusy, setPhotoBusy] = useState(false);
  const [draftSavedAt, setDraftSavedAt] = useState<Date | null>(null);

  const canvasRef = useRef<HandwritingCanvasHandle>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const dirtyRef = useRef(false);
  const tabBarRef = useRef<HTMLDivElement>(null);

  // ---- Note tabs: every note for this book + the current draft (if new) ----
  const allNotes = useMemo(
    () =>
      getNotesForBook(book.id).sort((a, b) => {
        const da = a.updatedAt ?? a.createdAt ?? "";
        const db = b.updatedAt ?? b.createdAt ?? "";
        return db.localeCompare(da);
      }),
    [book.id, existingNoteId],
  );

  // Auto-scroll active tab into view.
  useEffect(() => {
    const el = tabBarRef.current?.querySelector<HTMLElement>("[data-active-tab='true']");
    el?.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
  }, [existingNoteId]);

  // ---- draft recovery for NEW notes only ----
  useEffect(() => {
    if (!isNew) return;
    const d = getNoteDraft(book.id);
    if (d) setDraftPrompt(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const applyDraft = () => {
    const d = getNoteDraft(book.id);
    if (!d) {
      setDraftPrompt(false);
      return;
    }
    if (d.type) setNoteType((d.type as SimpleNoteType) ?? "other");
    if (d.inputMode) setMode(d.inputMode as NoteInputMode);
    setTitleVal(d.title ?? "");
    setContent(d.content ?? "");
    setQuoteText(d.quoteText ?? "");
    setChapter(d.chapter ?? "");
    if (d.chapterTitle !== undefined) setChapterTitle(d.chapterTitle);
    setPageNumber(d.pageNumber ?? "");
    setPhotoUrl(d.photoUrl);
    if (d.drawingBackground) setBackground(d.drawingBackground as NoteBackground);
    if (d.drawingDataUrl) setInitialDrawingForCanvas(d.drawingDataUrl);
    if (Array.isArray(d.tags)) setTags(d.tags);
    setDraftPrompt(false);
  };
  const discardDraft = () => {
    clearNoteDraft(book.id);
    setDraftPrompt(false);
  };

  // ---- dirty tracking ----
  const initializedRef = useRef(false);
  useEffect(() => {
    if (!initializedRef.current) {
      initializedRef.current = true;
      return;
    }
    dirtyRef.current = true;
  }, [
    titleVal,
    content,
    quoteText,
    chapter,
    chapterTitle,
    pageNumber,
    noteType,
    mode,
    photoUrl,
    background,
    tags,
  ]);

  // ---- autosave draft (new notes only) ----
  useEffect(() => {
    if (!isNew) return;
    const t = setTimeout(() => {
      if (!dirtyRef.current) return;
      const drawingDataUrl =
        mode === "handwriting" && canvasRef.current && canvasRef.current.hasInk()
          ? canvasRef.current.toDataUrl()
          : undefined;
      const res = setNoteDraft(book.id, {
        type: noteType,
        inputMode: mode,
        title: titleVal,
        content,
        quoteText,
        chapter,
        chapterTitle,
        pageNumber,
        photoUrl,
        drawingDataUrl,
        drawingBackground: background,
        tags,
        savedAt: new Date().toISOString(),
      });
      if (res.ok) setDraftSavedAt(new Date());
    }, 600);
    return () => clearTimeout(t);
  }, [
    isNew,
    book.id,
    noteType,
    mode,
    titleVal,
    content,
    quoteText,
    chapter,
    chapterTitle,
    pageNumber,
    photoUrl,
    background,
    tags,
  ]);

  useEffect(() => {
    const onBefore = (e: BeforeUnloadEvent) => {
      if (!dirtyRef.current) return;
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", onBefore);
    return () => window.removeEventListener("beforeunload", onBefore);
  }, []);

  const onSaveRef = useRef<() => void>(() => {});
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && (e.key === "s" || e.key === "S")) {
        e.preventDefault();
        onSaveRef.current?.();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
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

  const removePhoto = () => {
    setPhotoUrl(undefined);
    if (fileRef.current) fileRef.current.value = "";
  };

  const tryLeave = (fn: () => void) => {
    if (dirtyRef.current) {
      setShowLeave(() => fn);
      return;
    }
    fn();
  };

  const navigateToNote = (id: string) =>
    tryLeave(() =>
      router.navigate({
        to: "/book/$id/notes/$noteId",
        params: { id: book.id, noteId: id },
      }),
    );

  const navigateNew = () =>
    tryLeave(() => router.navigate({ to: "/book/$id/notes/new", params: { id: book.id } }));

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
      chapterTitle: chapterTitle.trim() || undefined,
      tags,
      photoUrl,
      inputMode: mode,
      drawingDataUrl: mode === "handwriting" ? drawingDataUrl : drawingBaseline,
      drawingBackground: mode === "handwriting" ? background : initial?.drawingBackground,
      isFavourite,
    };

    const res = existingNoteId
      ? updateNote(existingNoteId, payload)
      : createNote({ bookId: book.id, ...payload });

    if (!res.ok) {
      setError(
        res.quota
          ? "Brak miejsca na zapisanie tej notatki na tym urządzeniu. Usuń większe zdjęcie albo wybierz mniejszy plik."
          : "Nie udało się zapisać notatki.",
      );
      return;
    }

    dirtyRef.current = false;
    setDrawingBaseline(drawingDataUrl);
    if (isNew) clearNoteDraft(book.id);
    router.navigate({ to: categoryPath(noteType), params: { id: book.id } });
  };
  onSaveRef.current = onSave;

  const onCancel = () =>
    tryLeave(() => router.navigate({ to: "/book/$id/notes", params: { id: book.id } }));

  const onDelete = () => {
    if (!existingNoteId) return;
    deleteNote(existingNoteId);
    dirtyRef.current = false;
    setShowDelete(false);
    router.navigate({ to: categoryPath(noteType), params: { id: book.id } });
  };

  return (
    <div className="px-3 sm:px-6 lg:px-10 pb-28">
      <NotesHeader id={book.id} title={title} />
      <div className="hidden sm:block">
        <BookStrip book={book} />
      </div>
      <div className="sm:hidden mt-3 flex items-center gap-3 rounded-2xl bg-[var(--glass-inner)] border border-[var(--glass-border-soft)] p-2.5">
        {book.cover_url && (
          <img
            src={book.cover_url}
            alt=""
            className="w-10 h-14 rounded-lg object-cover shrink-0"
            loading="lazy"
          />
        )}

        <div className="min-w-0">
          <div className="truncate text-sm font-serif text-warm">{book.title}</div>
          <div className="truncate text-[11px] text-warm-muted">{book.author}</div>
        </div>
      </div>

      {/* ----- Note tabs (Apple Notes / Notability inspired) ----- */}
      <div className="mt-4 rounded-3xl bg-[var(--glass-inner)] border border-[var(--glass-border-soft)] p-1.5 overflow-hidden">
        <div
          ref={tabBarRef}
          className="flex gap-1.5 overflow-x-auto no-scrollbar"
          style={{ scrollbarWidth: "none" }}
        >
          {isNew && (
            <div
              data-active-tab="true"
              className="shrink-0 flex items-center gap-2 pl-3 pr-3 h-10 rounded-2xl bg-[var(--bg)] text-warm text-sm font-medium shadow-[0_2px_8px_-2px_rgba(60,40,20,0.18)] border border-[var(--glass-border)]"
            >
              <PenLine className="w-3.5 h-3.5 gold-text" />
              {titleVal.trim() ? titleVal.trim().slice(0, 28) : "Nowa notatka"}
            </div>
          )}
          {allNotes.map((n) => {
            const active = n.id === existingNoteId;
            return (
              <button
                key={n.id}
                type="button"
                onClick={() => !active && navigateToNote(n.id)}
                data-active-tab={active ? "true" : "false"}
                className={`shrink-0 flex items-center gap-2 pl-3 pr-3 h-10 rounded-2xl text-sm transition ${
                  active
                    ? "bg-[var(--bg)] text-warm font-medium shadow-[0_2px_8px_-2px_rgba(60,40,20,0.18)] border border-[var(--glass-border)]"
                    : "bg-transparent text-warm-muted hover:text-warm hover:bg-[var(--glass)]"
                }`}
                title={noteTabLabel(n)}
              >
                <span
                  className={`w-1.5 h-1.5 rounded-full ${
                    simpleType(n.type) === "quote"
                      ? "bg-[#b04e3a]"
                      : simpleType(n.type) === "chapter"
                        ? "bg-[#2c4a6b]"
                        : "bg-[var(--accent-gold)]"
                  }`}
                />
                <span className="max-w-[160px] truncate">{noteTabLabel(n)}</span>
              </button>
            );
          })}
          <button
            type="button"
            onClick={navigateNew}
            aria-label="Nowa notatka"
            title="Nowa notatka"
            className="shrink-0 h-10 w-10 grid place-items-center rounded-2xl text-warm-muted hover:text-[var(--accent-gold)] hover:bg-[var(--glass)] transition"
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>
      </div>

      {draftPrompt && (
        <div className="glass rounded-2xl p-4 mt-3 flex items-center justify-between gap-3 flex-wrap">
          <div className="text-sm text-warm font-serif">Znaleziono niezapisaną notatkę</div>
          <div className="flex gap-2">
            <button
              onClick={applyDraft}
              className="px-3 py-1.5 rounded-full bg-[var(--accent-gold)] text-[var(--bg)] text-xs"
            >
              Przywróć
            </button>
            <button
              onClick={discardDraft}
              className="px-3 py-1.5 rounded-full bg-[var(--glass-inner)] text-warm text-xs"
            >
              Usuń szkic
            </button>
          </div>
        </div>
      )}

      {/* ----- Type + Mode segmented controls ----- */}
      <div className="mt-3 sm:mt-4 grid grid-cols-2 sm:flex sm:flex-wrap gap-2 sm:gap-3">
        <div
          className="flex p-1 rounded-2xl bg-[var(--glass-inner)] border border-[var(--glass-border-soft)] w-full sm:w-auto"
          role="tablist"
          aria-label="Typ notatki"
        >
          {typeOptions.map((o) => {
            const active = noteType === o.value;
            const Icon = o.icon;
            return (
              <button
                key={o.value}
                type="button"
                onClick={() => setNoteType(o.value)}
                aria-pressed={active}
                className={`flex-1 sm:flex-initial inline-flex items-center justify-center gap-1 sm:gap-1.5 px-2 sm:px-4 h-9 rounded-xl text-xs sm:text-sm transition ${
                  active
                    ? "bg-[var(--bg)] text-warm font-medium shadow-[0_2px_6px_-2px_rgba(60,40,20,0.2)]"
                    : "text-warm-muted hover:text-warm"
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                {o.label}
              </button>
            );
          })}
        </div>

        <div
          className="flex p-1 rounded-2xl bg-[var(--glass-inner)] border border-[var(--glass-border-soft)] sm:ml-auto w-full sm:w-auto"
          role="tablist"
          aria-label="Tryb wprowadzania"
        >
          <button
            type="button"
            onClick={() => {
              if (mode === "handwriting" && canvasRef.current) {
                const snap = canvasRef.current.toDataUrl();
                if (snap) setInitialDrawingForCanvas(snap);
              }
              setMode("text");
            }}
            aria-pressed={mode === "text"}
            className={`flex-1 sm:flex-initial inline-flex items-center justify-center gap-1 sm:gap-1.5 px-2 sm:px-4 h-9 rounded-xl text-xs sm:text-sm transition ${
              mode === "text"
                ? "bg-[var(--bg)] text-warm font-medium shadow-[0_2px_6px_-2px_rgba(60,40,20,0.2)]"
                : "text-warm-muted hover:text-warm"
            }`}
          >
            <Type className="w-3.5 h-3.5" /> Tekst
          </button>
          <button
            type="button"
            onClick={() => setMode("handwriting")}
            aria-pressed={mode === "handwriting"}
            className={`flex-1 sm:flex-initial inline-flex items-center justify-center gap-1 sm:gap-1.5 px-2 sm:px-4 h-9 rounded-xl text-xs sm:text-sm transition ${
              mode === "handwriting"
                ? "bg-[var(--bg)] text-warm font-medium shadow-[0_2px_6px_-2px_rgba(60,40,20,0.2)]"
                : "text-warm-muted hover:text-warm"
            }`}
          >
            <PenLine className="w-3.5 h-3.5" /> Pismo
          </button>
        </div>
      </div>

      {/* ----- Paper sheet ----- */}
      <div className="mt-3 sm:mt-4 rounded-2xl sm:rounded-3xl bg-[#fdfaf4] dark:bg-[var(--glass-strong)] border border-[var(--glass-border-soft)] shadow-[0_30px_60px_-40px_rgba(60,40,20,0.45)] overflow-hidden">
        {/* Title bar inside the sheet */}
        <div className="px-4 sm:px-8 pt-5 sm:pt-8 pb-3 sm:pb-4 border-b border-[var(--glass-border-soft)]">
          <input
            value={titleVal}
            onChange={(e) => setTitleVal(e.target.value)}
            placeholder="Tytuł notatki"
            className="w-full bg-transparent text-warm placeholder:text-warm-muted/60 text-xl sm:text-3xl font-serif focus:outline-none"
          />
          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] uppercase tracking-wider text-warm-muted">
            {isNew && draftSavedAt && (
              <span aria-live="polite">
                Szkic ·{" "}
                {draftSavedAt.toLocaleTimeString("pl-PL", {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </span>
            )}
            <span className="hidden sm:inline ml-auto opacity-70 normal-case tracking-normal">
              ⌘/Ctrl + S aby zapisać
            </span>
          </div>
        </div>

        {/* Metadata row */}
        <div className="px-5 sm:px-8 py-4 grid sm:grid-cols-2 gap-3 border-b border-[var(--glass-border-soft)]">
          {noteType === "quote" && (
            <div className="sm:col-span-2">
              <Field label="Cytat">
                <textarea
                  value={quoteText}
                  onChange={(e) => setQuoteText(e.target.value)}
                  rows={2}
                  placeholder="„Wpisz cytat z książki…”"
                  className="w-full bg-[var(--glass-inner)] rounded-xl p-3 text-sm italic focus:outline-none focus:ring-2 focus:ring-[var(--accent-gold)]/40"
                />
              </Field>
            </div>
          )}

          {noteType === "chapter" && (
            <>
              <Field label="Rozdział (numer)">
                <input
                  value={chapter}
                  onChange={(e) => setChapter(e.target.value.replace(/[^0-9]/g, ""))}
                  inputMode="numeric"
                  className="w-full bg-transparent border-b border-[var(--glass-border)] py-1.5 text-sm focus:outline-none focus:border-[var(--accent-gold)]"
                />
              </Field>
              <Field label="Tytuł rozdziału">
                <input
                  value={chapterTitle}
                  onChange={(e) => setChapterTitle(e.target.value)}
                  placeholder="np. Wielki zwrot akcji"
                  className="w-full bg-transparent border-b border-[var(--glass-border)] py-1.5 text-sm focus:outline-none focus:border-[var(--accent-gold)]"
                />
              </Field>
            </>
          )}

          <Field label="Strona">
            <input
              inputMode="numeric"
              value={pageNumber}
              onChange={(e) => setPageNumber(e.target.value.replace(/[^0-9]/g, ""))}
              className="w-full bg-transparent border-b border-[var(--glass-border)] py-1.5 text-sm focus:outline-none focus:border-[var(--accent-gold)]"
            />
          </Field>

          <Field label="Tagi">
            <div className="flex flex-wrap items-center gap-1.5">
              {tags.map((t) => (
                <span
                  key={t}
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[var(--glass-inner)] text-warm text-xs"
                >
                  #{t}
                  <button
                    type="button"
                    onClick={() => setTags(tags.filter((x) => x !== t))}
                    aria-label={`Usuń tag ${t}`}
                    className="text-warm-muted hover:text-warm"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              ))}
              <input
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === ",") {
                    e.preventDefault();
                    const v = tagInput.trim().replace(/^#/, "").toLowerCase();
                    if (v && !tags.includes(v)) setTags([...tags, v]);
                    setTagInput("");
                  } else if (e.key === "Backspace" && !tagInput && tags.length) {
                    setTags(tags.slice(0, -1));
                  }
                }}
                placeholder="dodaj tag"
                className="flex-1 min-w-[100px] bg-transparent py-1 text-xs focus:outline-none"
              />
            </div>
          </Field>
        </div>

        {/* Body */}
        <div className="px-3 sm:px-6 py-4">
          {mode === "text" ? (
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={14}
              placeholder="Zacznij pisać…"
              className="w-full bg-transparent text-warm placeholder:text-warm-muted/60 text-[15px] leading-relaxed focus:outline-none resize-none px-2 sm:px-3 min-h-[360px] font-serif"
              style={{
                backgroundImage:
                  "repeating-linear-gradient(transparent 0px, transparent 31px, rgba(58,36,24,0.08) 31px, rgba(58,36,24,0.08) 32px)",
                lineHeight: "32px",
                paddingTop: "4px",
              }}
            />
          ) : (
            <HandwritingCanvas
              ref={canvasRef}
              background={background}
              onBackgroundChange={setBackground}
              initialDataUrl={initialDrawingForCanvas}
              minHeight={typeof window !== "undefined" && window.innerWidth >= 768 ? 620 : 340}
              onDirty={() => {
                dirtyRef.current = true;
              }}
            />
          )}
        </div>

        {/* Photo preview only — add button moved to action bar */}
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => onPickPhoto(e.target.files?.[0])}
        />
        {photoUrl && (
          <div className="px-4 sm:px-8 py-4 border-t border-[var(--glass-border-soft)]">
            <div className="flex items-center justify-between gap-3 mb-2">
              <span className="text-[11px] uppercase tracking-wider text-warm-muted">
                Zdjęcie strony
              </span>
              <button
                type="button"
                onClick={removePhoto}
                className="text-[11px] text-warm-muted hover:text-[#b04e3a]"
              >
                Usuń
              </button>
            </div>
            <img
              src={photoUrl}
              alt="Zdjęcie strony"
              className="w-full max-h-56 rounded-xl object-cover border border-[var(--glass-border)]"
            />
          </div>
        )}
      </div>

      {error && (
        <div className="mt-3 text-xs text-[var(--accent-gold)]" aria-live="polite">
          {error}
        </div>
      )}

      {/* Action bar */}
      <div className="sticky bottom-3 mt-4 z-10">
        <div className="glass rounded-full p-1.5 flex items-center gap-1 sm:gap-2 shadow-[0_18px_40px_-20px_rgba(60,40,20,0.45)]">
          <button
            type="button"
            onClick={onCancel}
            className="px-3 sm:px-5 h-11 rounded-full text-warm text-sm hover:bg-[var(--glass-inner)]"
          >
            Anuluj
          </button>
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={photoBusy}
            className="h-11 w-11 rounded-full grid place-items-center text-warm hover:text-[var(--accent-gold)] hover:bg-[var(--glass-inner)] disabled:opacity-50"
            title={photoUrl ? "Zmień zdjęcie" : "Dodaj zdjęcie"}
            aria-label={photoUrl ? "Zmień zdjęcie" : "Dodaj zdjęcie"}
          >
            <ImagePlus className="w-4 h-4" />
          </button>
          {existingNoteId && (
            <button
              type="button"
              onClick={() => setShowDelete(true)}
              className="h-11 w-11 rounded-full grid place-items-center text-warm hover:text-[#b04e3a] hover:bg-[var(--glass-inner)]"
              title="Usuń notatkę"
              aria-label="Usuń notatkę"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
          <button
            type="button"
            onClick={() => {
              const next = !isFavourite;
              setIsFavourite(next);
              if (existingNoteId) updateNote(existingNoteId, { isFavourite: next });
            }}
            className={`h-11 w-11 rounded-full grid place-items-center hover:bg-[var(--glass-inner)] transition ${isFavourite ? "text-rose-500" : "text-warm"}`}
            title={isFavourite ? "Usuń z ulubionych" : "Dodaj do ulubionych"}
            aria-label={isFavourite ? "Usuń z ulubionych" : "Dodaj do ulubionych"}
            aria-pressed={isFavourite}
          >
            <Heart className={`w-4 h-4 ${isFavourite ? "fill-current" : ""}`} />
          </button>
          <button
            type="button"
            onClick={onSave}
            className="flex-1 ml-auto sm:flex-initial sm:px-8 h-11 rounded-full bg-[var(--accent-gold)] text-[var(--bg)] text-sm font-medium hover:brightness-105 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent-gold)]"
          >
            Zapisz
          </button>
        </div>
      </div>

      {showLeave && (
        <ConfirmModal
          title="Opuścić bez zapisywania?"
          body="Masz niezapisane zmiany w tej notatce."
          confirmLabel="Opuść"
          cancelLabel="Zostań"
          onConfirm={() => {
            const fn = showLeave;
            setShowLeave(null);
            dirtyRef.current = false;
            fn();
          }}
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
  title,
  body,
  confirmLabel,
  cancelLabel,
  onConfirm,
  onCancel,
}: {
  title: string;
  body: string;
  confirmLabel: string;
  cancelLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="note-confirm-title"
      onClick={onCancel}
    >
      <div className="glass rounded-2xl p-6 max-w-sm w-full" onClick={(e) => e.stopPropagation()}>
        <h3 id="note-confirm-title" className="font-serif text-lg mb-2">
          {title}
        </h3>
        <p className="text-sm text-warm-muted mb-5">{body}</p>
        <div className="flex gap-2 justify-end">
          <button
            onClick={onCancel}
            className="px-4 py-2 rounded-full bg-[var(--glass-inner)] text-warm text-sm"
          >
            {cancelLabel}
          </button>
          <button
            onClick={onConfirm}
            className="px-4 py-2 rounded-full bg-[var(--accent-gold)] text-[var(--bg)] text-sm font-medium"
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
