import { createFileRoute, Link } from "@tanstack/react-router";
import { PageHeader } from "@/components/PageHeader";
import { useEffect, useMemo, useState } from "react";
import { Lock, ArrowRight, LogOut, UserRound, Trash2, Pencil, Check, X, Tag } from "lucide-react";
import { DatabaseStatus } from "@/components/DatabaseStatus";
import { BackupPanel } from "@/components/BackupPanel";
import { GoalsPanel } from "@/components/GoalsPanel";
import { estimateStorageBytes, formatBytes } from "@/lib/backup";
import { useAuth } from "@/lib/auth-context";
import { SHOW_AUTH_UI } from "@/lib/feature-flags";
import {
  getDefaultBookStatus,
  setDefaultBookStatus,
  getDefaultNoteMode,
  setDefaultNoteMode,
} from "@/lib/preferences";
import { statusLabel, type BookStatus, type NoteInputMode } from "@/lib/mock-data";
import { getAllBooks, updateBook, useBooksVersion } from "@/lib/books-store";
import { getAllNotes, updateNote, useNotesVersion } from "@/lib/notes-store";

export const Route = createFileRoute("/settings")({
  head: () => ({ meta: [{ title: "Ustawienia — Agata" }] }),
  component: Settings,
});

const sections = [
  ...(SHOW_AUTH_UI ? ["Konto", "Synchronizacja z chmurą"] : []),
  "Prywatność i dostęp Gigi",
  "Status serwera",
  "Motywy",
  "Cele czytelnicze",
  "Kopia zapasowa",
  "Domyślny status książki",
  "Domyślny styl notatki",
  "Zarządzaj tagami",
  "Pamięć",
  "O Agacie",
];

const gigiOptions = [
  "Wyłączone",
  "Tylko aktualna książka",
  "Tylko wybrane notatki",
  "Cała biblioteka",
  "Cała biblioteka + rozmowy",
];

// Sections with a dedicated panel; anything outside this set shows the
// "coming soon" fallback (currently none — kept as a safety net).
const HANDLED_SECTIONS = new Set([
  "Konto",
  "Synchronizacja z chmurą",
  "Prywatność i dostęp Gigi",
  "Status serwera",
  "Motywy",
  "Cele czytelnicze",
  "Kopia zapasowa",
  "Domyślny status książki",
  "Domyślny styl notatki",
  "Zarządzaj tagami",
  "Pamięć",
  "O Agacie",
]);

const GIGI_STORAGE_KEY = "agata-gigi-privacy";

function Settings() {
  const [section, setSection] = useState(sections[0]);
  const [gigi, setGigi] = useState(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem(GIGI_STORAGE_KEY) ?? "Cała biblioteka + rozmowy";
    }
    return "Cała biblioteka + rozmowy";
  });
  const { user, signOut } = useAuth();

  function changeGigi(o: string) {
    setGigi(o);
    if (typeof window !== "undefined") localStorage.setItem(GIGI_STORAGE_KEY, o);
  }

  return (
    <div>
      <PageHeader title="Ustawienia" subtitle="Twoja przestrzeń, Twoje zasady." />
      <div className="px-5 lg:px-10 pb-12 space-y-4 lg:space-y-0 lg:grid lg:grid-cols-[260px_1fr] lg:gap-6">
        {/* Mobile: section picker */}
        <div className="lg:hidden">
          <select
            value={section}
            onChange={(e) => setSection(e.target.value)}
            className="w-full px-4 py-3 rounded-xl border border-border bg-card text-sm"
            aria-label="Przejdź do sekcji ustawień"
          >
            {sections.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>

        {/* Desktop: sidebar nav */}
        <nav
          className="hidden lg:block bg-card rounded-3xl p-3 shadow-soft h-fit"
          aria-label="Sekcje ustawień"
        >
          {sections.map((s) => (
            <button
              key={s}
              onClick={() => setSection(s)}
              aria-current={section === s ? "page" : undefined}
              className={`w-full text-left px-3 py-2.5 rounded-xl text-sm ${
                section === s ? "bg-primary text-primary-foreground" : "hover:bg-muted"
              }`}
            >
              {s}
            </button>
          ))}
          {SHOW_AUTH_UI &&
            (user ? (
              <button
                onClick={() => signOut()}
                className="w-full text-left px-3 py-2.5 rounded-xl text-sm text-destructive hover:bg-muted flex items-center gap-2"
              >
                <LogOut className="w-4 h-4" aria-hidden="true" />
                Wyloguj
              </button>
            ) : (
              <Link
                to="/auth"
                className="w-full text-left px-3 py-2.5 rounded-xl text-sm text-primary hover:bg-muted flex items-center gap-2"
              >
                <UserRound className="w-4 h-4" aria-hidden="true" />
                Zaloguj się
              </Link>
            ))}
        </nav>

        <div className="bg-card rounded-3xl p-6 shadow-soft">
          <h2 className="font-serif text-2xl mb-1">{section}</h2>
          {section === "Konto" && (
            <>
              {user ? (
                <div className="space-y-5">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-full bg-primary text-primary-foreground grid place-items-center text-lg font-bold">
                      {user.email?.[0]?.toUpperCase() || "U"}
                    </div>
                    <div>
                      <div className="text-sm font-medium">{user.email}</div>
                      <div className="text-xs text-muted-foreground">Zalogowano</div>
                    </div>
                  </div>
                  <button
                    onClick={() => signOut()}
                    className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-destructive text-destructive-foreground text-sm font-medium hover:opacity-90 transition-opacity"
                  >
                    <LogOut className="w-4 h-4" aria-hidden="true" />
                    Wyloguj
                  </button>
                </div>
              ) : (
                <div className="space-y-5">
                  <p className="text-sm text-muted-foreground">
                    Zaloguj się, aby synchronizować dane między urządzeniami i w przyszłości
                    korzystać z Gigi.
                  </p>
                  <Link
                    to="/auth"
                    className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition-opacity"
                  >
                    Zaloguj się
                    <ArrowRight className="w-4 h-4" aria-hidden="true" />
                  </Link>
                </div>
              )}
            </>
          )}
          {section === "Synchronizacja z chmurą" && (
            <p className="text-sm text-muted-foreground mt-2">
              Synchronizacja z chmurą zostanie dodana po przejściu na bazę SQLite na VPS.
            </p>
          )}
          {section === "Prywatność i dostęp Gigi" && (
            <>
              <p className="text-sm text-muted-foreground">
                Wybierz, do czego Gigi ma dostęp w Twojej bibliotece. Gigi jest na razie w wersji
                zapowiedzi — te ustawienia zaczną działać, gdy podłączę ją do Twojego modelu.
              </p>
              <div role="radiogroup" aria-label="Poziom dostępu Gigi" className="mt-5 space-y-2">
                {gigiOptions.map((o) => (
                  <button
                    key={o}
                    role="radio"
                    aria-checked={gigi === o}
                    onClick={() => changeGigi(o)}
                    className={`w-full flex items-center justify-between p-4 rounded-xl border transition ${
                      gigi === o ? "border-primary bg-primary/10" : "border-border hover:bg-muted"
                    }`}
                  >
                    <span className="text-sm">{o}</span>
                    <span
                      className={`w-4 h-4 rounded-full border-2 ${
                        gigi === o ? "border-primary bg-primary" : "border-border"
                      }`}
                      aria-hidden="true"
                    />
                  </button>
                ))}
              </div>
              <div className="mt-6 flex items-start gap-2 p-4 rounded-xl bg-muted text-xs text-muted-foreground">
                <Lock className="w-4 h-4 mt-0.5" aria-hidden="true" />
                <div>
                  Wszystko jest prywatne. Tylko Ty widzisz swoje dane — bez publicznych profili,
                  feedu społecznościowego ani reklam.
                </div>
              </div>
            </>
          )}
          {section === "Status serwera" && (
            <div className="mt-4">
              <DatabaseStatus />
            </div>
          )}
          {section === "Kopia zapasowa" && (
            <div className="mt-4">
              <BackupPanel />
            </div>
          )}
          {section === "Cele czytelnicze" && (
            <div className="mt-4">
              <GoalsPanel />
            </div>
          )}
          {section === "Motywy" && (
            <div className="mt-4 space-y-3">
              <p className="text-sm text-muted-foreground">
                Wybierz jasny lub ciemny motyw oraz podejrzyj warianty kolorów.
              </p>
              <Link
                to="/themes"
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition-opacity"
              >
                Otwórz motywy
                <ArrowRight className="w-4 h-4" aria-hidden="true" />
              </Link>
            </div>
          )}
          {section === "Pamięć" && <StoragePanel />}
          {section === "Domyślny status książki" && <DefaultBookStatusPanel />}
          {section === "Domyślny styl notatki" && <DefaultNoteStylePanel />}
          {section === "Zarządzaj tagami" && <TagManagerPanel />}
          {section === "O Agacie" && <AboutPanel />}
          {!HANDLED_SECTIONS.has(section) && (
            <p className="text-sm text-muted-foreground mt-2">
              Ta sekcja pojawi się wkrótce. Agata działa lokalnie na tym urządzeniu — nie musisz
              niczego konfigurować, żeby zacząć.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

const BOOK_STATUS_CHOICES: BookStatus[] = ["queue", "reading", "paused", "finished", "dropped"];

function DefaultBookStatusPanel() {
  const [value, setValue] = useState<BookStatus>(() => getDefaultBookStatus());
  const choose = (s: BookStatus) => {
    setValue(s);
    setDefaultBookStatus(s);
  };
  return (
    <div className="mt-4">
      <p className="text-sm text-muted-foreground mb-5">
        Status nadawany nowym książkom dodawanym do biblioteki. Zawsze możesz go zmienić później na
        stronie książki.
      </p>
      <div role="radiogroup" aria-label="Domyślny status książki" className="space-y-2">
        {BOOK_STATUS_CHOICES.map((s) => (
          <button
            key={s}
            role="radio"
            aria-checked={value === s}
            onClick={() => choose(s)}
            className={`w-full flex items-center justify-between p-4 rounded-xl border transition ${
              value === s ? "border-primary bg-primary/10" : "border-border hover:bg-muted"
            }`}
          >
            <span className="text-sm">{statusLabel(s)}</span>
            <span
              className={`w-4 h-4 rounded-full border-2 ${
                value === s ? "border-primary bg-primary" : "border-border"
              }`}
              aria-hidden="true"
            />
          </button>
        ))}
      </div>
    </div>
  );
}

const NOTE_MODE_CHOICES: { value: NoteInputMode; label: string; hint: string }[] = [
  { value: "handwriting", label: "Pismo odręczne", hint: "Rysowanie rysikiem, jak na iPadzie." },
  { value: "text", label: "Tekst", hint: "Pisanie na klawiaturze." },
];

function DefaultNoteStylePanel() {
  const [value, setValue] = useState<NoteInputMode>(() => getDefaultNoteMode());
  const choose = (m: NoteInputMode) => {
    setValue(m);
    setDefaultNoteMode(m);
  };
  return (
    <div className="mt-4">
      <p className="text-sm text-muted-foreground mb-5">
        Tryb, w którym otwierają się nowe notatki. Możesz przełączać się między pismem a tekstem w
        każdej chwili podczas pisania.
      </p>
      <div role="radiogroup" aria-label="Domyślny styl notatki" className="space-y-2">
        {NOTE_MODE_CHOICES.map((m) => (
          <button
            key={m.value}
            role="radio"
            aria-checked={value === m.value}
            onClick={() => choose(m.value)}
            className={`w-full flex items-center justify-between gap-3 p-4 rounded-xl border text-left transition ${
              value === m.value ? "border-primary bg-primary/10" : "border-border hover:bg-muted"
            }`}
          >
            <span>
              <span className="block text-sm">{m.label}</span>
              <span className="block text-xs text-muted-foreground">{m.hint}</span>
            </span>
            <span
              className={`w-4 h-4 rounded-full border-2 shrink-0 ${
                value === m.value ? "border-primary bg-primary" : "border-border"
              }`}
              aria-hidden="true"
            />
          </button>
        ))}
      </div>
    </div>
  );
}

interface TagUsage {
  tag: string;
  books: number;
  notes: number;
}

function collectTags(): TagUsage[] {
  const map = new Map<string, { books: number; notes: number }>();
  for (const b of getAllBooks()) {
    for (const t of b.tags ?? []) {
      const e = map.get(t) ?? { books: 0, notes: 0 };
      e.books += 1;
      map.set(t, e);
    }
  }
  for (const n of getAllNotes()) {
    for (const t of n.tags ?? []) {
      const e = map.get(t) ?? { books: 0, notes: 0 };
      e.notes += 1;
      map.set(t, e);
    }
  }
  return [...map.entries()]
    .map(([tag, c]) => ({ tag, books: c.books, notes: c.notes }))
    .sort((a, b) => a.tag.localeCompare(b.tag, "pl"));
}

function applyTagChange(from: string, to: string | null) {
  // to === null removes the tag; otherwise renames from→to (deduping).
  for (const b of getAllBooks()) {
    if (!b.tags?.includes(from)) continue;
    const next = b.tags.filter((t) => t !== from && t !== to);
    if (to) next.push(to);
    updateBook(b.id, { tags: next });
  }
  for (const n of getAllNotes()) {
    if (!n.tags?.includes(from)) continue;
    const next = n.tags.filter((t) => t !== from && t !== to);
    if (to) next.push(to);
    updateNote(n.id, { tags: next });
  }
}

function TagManagerPanel() {
  // Re-read whenever books/notes change so counts stay live.
  const booksVersion = useBooksVersion();
  const notesVersion = useNotesVersion();
  const tags = useMemo(() => collectTags(), [booksVersion, notesVersion]);
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [confirmDel, setConfirmDel] = useState<string | null>(null);

  const startRename = (tag: string) => {
    setEditing(tag);
    setDraft(tag);
    setConfirmDel(null);
  };
  const saveRename = (from: string) => {
    const to = draft.trim();
    if (to && to !== from) applyTagChange(from, to);
    setEditing(null);
  };

  if (tags.length === 0) {
    return (
      <p className="text-sm text-muted-foreground mt-4">
        Nie masz jeszcze żadnych tagów. Tagi dodajesz do książek i notatek — pojawią się tutaj, gdy
        zaczniesz ich używać.
      </p>
    );
  }

  return (
    <div className="mt-4">
      <p className="text-sm text-muted-foreground mb-5">
        Zmień nazwę lub usuń tag w całej bibliotece naraz. Zmiany dotyczą wszystkich książek i
        notatek, w których tag występuje.
      </p>
      <ul className="divide-y divide-border rounded-xl border border-border overflow-hidden">
        {tags.map((t) => (
          <li key={t.tag} className="flex items-center gap-3 p-3 bg-card">
            {editing === t.tag ? (
              <>
                <Tag className="w-4 h-4 text-muted-foreground shrink-0" aria-hidden="true" />
                <input
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") saveRename(t.tag);
                    if (e.key === "Escape") setEditing(null);
                  }}
                  aria-label={`Nowa nazwa tagu ${t.tag}`}
                  autoFocus
                  className="flex-1 min-w-0 px-3 py-1.5 rounded-lg border border-border bg-background text-sm"
                />
                <button
                  onClick={() => saveRename(t.tag)}
                  aria-label="Zapisz nazwę"
                  className="w-8 h-8 grid place-items-center rounded-full bg-primary text-primary-foreground shrink-0"
                >
                  <Check className="w-4 h-4" aria-hidden="true" />
                </button>
                <button
                  onClick={() => setEditing(null)}
                  aria-label="Anuluj"
                  className="w-8 h-8 grid place-items-center rounded-full bg-muted text-foreground shrink-0"
                >
                  <X className="w-4 h-4" aria-hidden="true" />
                </button>
              </>
            ) : (
              <>
                <Tag className="w-4 h-4 text-muted-foreground shrink-0" aria-hidden="true" />
                <span className="flex-1 min-w-0 truncate text-sm">{t.tag}</span>
                <span className="text-xs text-muted-foreground shrink-0">
                  {t.books > 0 && `${t.books} ks.`}
                  {t.books > 0 && t.notes > 0 && " · "}
                  {t.notes > 0 && `${t.notes} not.`}
                </span>
                {confirmDel === t.tag ? (
                  <span className="inline-flex gap-1 shrink-0">
                    <button
                      onClick={() => {
                        applyTagChange(t.tag, null);
                        setConfirmDel(null);
                      }}
                      className="px-2.5 py-1 rounded-full bg-destructive text-destructive-foreground text-xs"
                    >
                      Usuń
                    </button>
                    <button
                      onClick={() => setConfirmDel(null)}
                      className="px-2.5 py-1 rounded-full bg-muted text-foreground text-xs"
                    >
                      Anuluj
                    </button>
                  </span>
                ) : (
                  <span className="inline-flex gap-1 shrink-0">
                    <button
                      onClick={() => startRename(t.tag)}
                      aria-label={`Zmień nazwę tagu ${t.tag}`}
                      className="w-8 h-8 grid place-items-center rounded-full bg-muted text-foreground"
                    >
                      <Pencil className="w-3.5 h-3.5" aria-hidden="true" />
                    </button>
                    <button
                      onClick={() => setConfirmDel(t.tag)}
                      aria-label={`Usuń tag ${t.tag}`}
                      className="w-8 h-8 grid place-items-center rounded-full bg-muted text-foreground"
                    >
                      <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                    </button>
                  </span>
                )}
              </>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

function AboutPanel() {
  return (
    <div className="mt-4 space-y-4 text-sm text-muted-foreground">
      <p>
        <span className="font-serif text-base text-foreground">Agata</span> to Twoja prywatna
        przestrzeń na książki, notatki i refleksje. Wszystko działa lokalnie na tym urządzeniu — bez
        kont, bez śledzenia, bez reklam.
      </p>
      <ul className="space-y-1.5 list-disc pl-5">
        <li>Biblioteka z wyszukiwaniem książek z OpenLibrary i Google Books.</li>
        <li>Notatki tekstowe i odręczne, cytaty oraz zdjęcia stron.</li>
        <li>Sesje czytania i statystyki liczone wyłącznie z Twoich danych.</li>
        <li>Kopie zapasowe, które możesz wyeksportować i zaimportować w każdej chwili.</li>
      </ul>
      <p>
        Twoje dane należą do Ciebie. Skorzystaj z sekcji „Kopia zapasowa", aby zapisać je w pliku.
      </p>
    </div>
  );
}

function StoragePanel() {
  const [bytes, setBytes] = useState<number | null>(null);
  useEffect(() => {
    setBytes(estimateStorageBytes());
  }, []);
  // Browsers typically allow ~5 MB of localStorage per origin.
  const limit = 5 * 1024 * 1024;
  const pct = bytes == null ? 0 : Math.min(100, Math.round((bytes / limit) * 100));
  return (
    <div className="mt-4 space-y-4">
      <p className="text-sm text-muted-foreground">
        Agata przechowuje Twoje książki, notatki, rysunki i zdjęcia stron lokalnie na tym
        urządzeniu. Rób kopię zapasową, aby ich nie stracić.
      </p>
      <div className="p-4 rounded-xl bg-muted">
        <div className="flex items-baseline justify-between">
          <span className="text-[10px] uppercase tracking-widest text-muted-foreground">
            Zajęte miejsce
          </span>
          <span className="text-sm font-medium">
            {bytes == null ? "—" : `${formatBytes(bytes)} z ~${formatBytes(limit)}`}
          </span>
        </div>
        <div className="mt-2 h-2 rounded-full bg-border overflow-hidden">
          <div
            className="h-full bg-primary transition-all"
            style={{ width: `${pct}%` }}
            role="progressbar"
            aria-valuenow={pct}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label="Wykorzystana pamięć lokalna"
          />
        </div>
      </div>
    </div>
  );
}
