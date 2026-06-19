import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import {
  ArrowLeft,
  Search,
  Hash,
  ScanLine,
  PenLine,
  Loader2,
  X,
  Upload,
  Camera,
  CameraOff,
} from "lucide-react";
import { Info, Globe, BookOpen, ExternalLink, Star, Eye, ShoppingCart, Quote } from "lucide-react";
import {
  searchBooks,
  lookupByIsbn,
  enrichBookDetails,
  sourceLabel,
  sourceUrl,
  type BookSearchResult,
} from "@/lib/book-search";
import {
  createBook,
  isDuplicateBook,
  compressCoverFile,
  type CreateBookInput,
} from "@/lib/books-store";
import type { Book } from "@/lib/mock-data";

export const Route = createFileRoute("/add-book")({
  head: () => ({ meta: [{ title: "Dodaj książkę — Agata" }] }),
  component: AddBook,
});

type Tab = "search" | "isbn" | "scan" | "manual";

function AddBook() {
  const [tab, setTab] = useState<Tab>("search");
  const tabs: { id: Tab; label: string; icon: typeof Search }[] = [
    { id: "search", label: "Szukaj", icon: Search },
    { id: "isbn", label: "ISBN", icon: Hash },
    { id: "scan", label: "Skanuj", icon: ScanLine },
    { id: "manual", label: "Ręcznie", icon: PenLine },
  ];
  return (
    <div className="px-4 sm:px-6 lg:px-10 pb-16 max-w-3xl">
      <div className="flex items-center gap-3 pt-4">
        <Link
          to="/library"
          aria-label="Wróć"
          className="w-10 h-10 grid place-items-center rounded-full glass text-warm hover:bg-[var(--glass-inner)]"
        >
          <ArrowLeft className="w-4 h-4 gold-text" />
        </Link>
      </div>
      <PageHeader title="Dodaj książkę" subtitle="Wyszukaj, zeskanuj albo dodaj książkę ręcznie." />
      <div className="flex gap-1.5 sm:gap-2 mb-5 overflow-x-auto no-scrollbar">
        {tabs.map((t) => {
          const active = tab === t.id;
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`px-3.5 py-2 rounded-full inline-flex items-center gap-1.5 text-sm whitespace-nowrap border transition ${active ? "bg-[var(--accent-gold)] text-[var(--bg)] border-[var(--accent-gold)]" : "glass border-[var(--glass-border)] text-warm hover:bg-[var(--glass-inner)]"}`}
            >
              <t.icon className="w-4 h-4" /> {t.label}
            </button>
          );
        })}
      </div>
      {tab === "search" && <SearchTab />}
      {tab === "isbn" && <IsbnTab />}
      {tab === "scan" && (
        <ScanTab
          onIsbn={(v) => {
            setTab("isbn");
            window.dispatchEvent(new CustomEvent("agata-prefill-isbn", { detail: v }));
          }}
        />
      )}
      {tab === "manual" && <ManualTab />}
    </div>
  );
}

// ---------- Search ----------
function SearchTab() {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<BookSearchResult[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onSearch = async () => {
    if (!q.trim()) return;
    setLoading(true);
    setError(null);
    setResults(null);
    try {
      const r = await searchBooks(q.trim());
      setResults(r);
    } catch {
      setError("Nie udało się wyszukać książek. Spróbuj ponownie.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="glass rounded-2xl p-3 flex gap-2">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") onSearch();
          }}
          placeholder="Wpisz tytuł albo autora"
          className="flex-1 bg-[var(--glass-inner)] rounded-xl px-4 py-2.5 text-sm text-warm focus:outline-none"
        />
        <button
          onClick={onSearch}
          disabled={loading || !q.trim()}
          className="px-4 py-2.5 rounded-xl bg-[var(--accent-gold)] text-[var(--bg)] text-sm font-medium disabled:opacity-50 inline-flex items-center gap-1.5"
        >
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
          Szukaj książki
        </button>
      </div>
      {loading && <div className="text-sm text-warm-muted">Szukanie…</div>}
      {error && <div className="text-sm text-rose-500">{error}</div>}
      {results && results.length === 0 && !loading && (
        <div className="text-sm text-warm-muted">Nie znaleziono książek</div>
      )}
      {results && results.length > 0 && (
        <div className="space-y-3">
          {results.map((r) => (
            <ResultCard key={`${r.source}-${r.external_id}`} r={r} />
          ))}
        </div>
      )}
    </div>
  );
}

function ResultCard({ r }: { r: BookSearchResult }) {
  const router = useRouter();
  const [msg, setMsg] = useState<string | null>(null);
  const [dup, setDup] = useState<Book | null>(null);
  const [showDetails, setShowDetails] = useState(false);

  const buildInput = (data: BookSearchResult): CreateBookInput => ({
    title: data.title,
    author: data.author,
    isbn: data.isbn,
    cover_url: data.cover_url,
    description: data.description,
    pageCount: data.page_count || 0,
    publishedDate: data.published_date,
    genre: data.category,
    publisher: data.publisher,
    language: data.language,
    status: "queue",
    source: data.source,
  });

  const add = (force = false, data: BookSearchResult = r) => {
    const existing =
      !force && isDuplicateBook({ isbn: data.isbn, title: data.title, author: data.author });
    if (existing) {
      setDup(existing);
      return;
    }
    const res = createBook(buildInput(data));
    if (res.ok && res.book) {
      setMsg("Książka dodana do biblioteki");
      router.navigate({ to: "/book/$id", params: { id: res.book.id } });
    } else {
      setMsg(res.error || "Nie udało się zapisać książki.");
    }
  };

  if (dup) {
    return (
      <div className="glass rounded-2xl p-4 space-y-3">
        <div className="font-serif text-warm">Ta książka jest już w bibliotece</div>
        <div className="text-sm text-warm-muted">
          {dup.title} — {dup.author}
        </div>
        <div className="flex gap-2 flex-wrap">
          <Link
            to="/book/$id"
            params={{ id: dup.id }}
            className="px-3 py-1.5 rounded-full bg-[var(--accent-gold)] text-[var(--bg)] text-xs"
          >
            Otwórz książkę
          </Link>
          <button
            onClick={() => add(true)}
            className="px-3 py-1.5 rounded-full glass text-warm text-xs"
          >
            Dodaj mimo to
          </button>
          <button
            onClick={() => setDup(null)}
            className="px-3 py-1.5 rounded-full glass text-warm text-xs"
          >
            Anuluj
          </button>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="glass rounded-2xl p-3 flex gap-3">
        <button
          type="button"
          onClick={() => setShowDetails(true)}
          className="w-[64px] h-[96px] rounded-lg overflow-hidden bg-[var(--glass-inner)] shrink-0 grid place-items-center hover:opacity-80 transition"
          aria-label="Pokaż szczegóły"
        >
          {r.cover_url ? (
            <img src={r.cover_url} alt="" className="w-full h-full object-cover" loading="lazy" />
          ) : (
            <span className="text-[10px] text-warm-muted">Brak okładki</span>
          )}
        </button>
        <div className="flex-1 min-w-0">
          <div className="font-serif text-warm leading-tight line-clamp-2">{r.title}</div>
          {r.subtitle && (
            <div className="text-[11px] text-warm-muted italic mt-0.5 line-clamp-1">
              {r.subtitle}
            </div>
          )}
          <div className="text-xs text-warm-muted mt-0.5 line-clamp-1">{r.author}</div>
          <div className="text-[11px] text-warm-muted mt-1 flex items-center gap-1.5 flex-wrap">
            <span>
              {[r.published_date, r.page_count ? `${r.page_count} s.` : null, r.category]
                .filter(Boolean)
                .join(" · ") || "Brak danych"}
            </span>
            {r.rating ? (
              <span className="px-1.5 py-0.5 rounded-full bg-[var(--glass-inner)] text-[10px] inline-flex items-center gap-0.5">
                <Star className="w-2.5 h-2.5 fill-current" /> {r.rating.toFixed(1)}
              </span>
            ) : null}
            {r.language === "pl" && (
              <span className="px-1.5 py-0.5 rounded-full bg-[var(--glass-inner)] text-[10px] uppercase tracking-wider">
                PL
              </span>
            )}
            <span className="px-1.5 py-0.5 rounded-full bg-[var(--glass-inner)] text-[10px]">
              {sourceLabel(r.source)}
            </span>
          </div>
          <div className="mt-2 flex gap-2 flex-wrap">
            <button
              onClick={() => setShowDetails(true)}
              className="px-3 py-1.5 rounded-full glass text-warm text-xs font-medium inline-flex items-center gap-1"
            >
              <Info className="w-3.5 h-3.5" /> Szczegóły
            </button>
            <button
              onClick={() => add(false)}
              className="px-3 py-1.5 rounded-full bg-[var(--accent-gold)] text-[var(--bg)] text-xs font-medium"
            >
              Dodaj do biblioteki
            </button>
          </div>
          {msg && <div className="text-[11px] text-warm-muted mt-1">{msg}</div>}
        </div>
      </div>
      {showDetails && (
        <BookDetailsModal
          initial={r}
          onClose={() => setShowDetails(false)}
          onAdd={(data) => {
            setShowDetails(false);
            add(false, data);
          }}
        />
      )}
    </>
  );
}

// ---------- Details Modal ----------
function BookDetailsModal({
  initial,
  onClose,
  onAdd,
}: {
  initial: BookSearchResult;
  onClose: () => void;
  onAdd: (data: BookSearchResult) => void;
}) {
  const [data, setData] = useState<BookSearchResult>(initial);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let alive = true;
    // Always enrich — pulls rating/preview/HD cover for OL, full desc for Google.
    setLoading(true);
    enrichBookDetails(initial)
      .then((d) => {
        if (alive) setData(d);
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [initial]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  const dup = isDuplicateBook({ isbn: data.isbn, title: data.title, author: data.author });
  const url = sourceUrl(data);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Szczegóły książki"
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="glass w-full sm:max-w-2xl max-h-[92vh] sm:max-h-[85vh] overflow-y-auto rounded-t-3xl sm:rounded-3xl border border-[var(--glass-border)] flex flex-col"
      >
        <div className="sticky top-0 z-10 flex items-center justify-between px-5 py-3 bg-[var(--bg)]/70 backdrop-blur border-b border-[var(--glass-border)]">
          <div className="text-xs uppercase tracking-wider text-warm-muted inline-flex items-center gap-1.5">
            <BookOpen className="w-3.5 h-3.5" /> {sourceLabel(data.source)}
          </div>
          <button
            onClick={onClose}
            aria-label="Zamknij"
            className="w-8 h-8 grid place-items-center rounded-full glass text-warm hover:bg-[var(--glass-inner)]"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="p-5 flex gap-4 flex-col sm:flex-row">
          <div className="w-[140px] h-[210px] sm:w-[160px] sm:h-[240px] mx-auto sm:mx-0 rounded-xl overflow-hidden bg-[var(--glass-inner)] shrink-0 grid place-items-center">
            {data.cover_url ? (
              <img src={data.cover_url} alt={data.title} className="w-full h-full object-cover" />
            ) : (
              <span className="text-[11px] text-warm-muted">Brak okładki</span>
            )}
          </div>
          <div className="flex-1 min-w-0 space-y-2">
            <h2 className="font-serif text-warm text-xl leading-tight">{data.title}</h2>
            <div className="text-sm text-warm-muted">{data.author}</div>
            <dl className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-xs mt-3">
              {data.publisher && (
                <>
                  <dt className="text-warm-muted">Wydawnictwo</dt>
                  <dd className="text-warm">{data.publisher}</dd>
                </>
              )}
              {data.published_date && (
                <>
                  <dt className="text-warm-muted">Data wydania</dt>
                  <dd className="text-warm">{data.published_date}</dd>
                </>
              )}
              {data.page_count ? (
                <>
                  <dt className="text-warm-muted">Liczba stron</dt>
                  <dd className="text-warm">{data.page_count}</dd>
                </>
              ) : null}
              {data.language && (
                <>
                  <dt className="text-warm-muted">Język</dt>
                  <dd className="text-warm uppercase inline-flex items-center gap-1">
                    <Globe className="w-3 h-3" /> {data.language}
                  </dd>
                </>
              )}
              {data.category && (
                <>
                  <dt className="text-warm-muted">Kategoria</dt>
                  <dd className="text-warm">{data.category}</dd>
                </>
              )}
              {data.isbn && (
                <>
                  <dt className="text-warm-muted">ISBN</dt>
                  <dd className="text-warm font-mono">{data.isbn}</dd>
                </>
              )}
            </dl>
          </div>
        </div>
        <div className="px-5 pb-4">
          <div className="text-[11px] uppercase tracking-wider text-warm-muted mb-1.5">Opis</div>
          {loading ? (
            <div className="text-sm text-warm-muted inline-flex items-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin" /> Ładowanie opisu…
            </div>
          ) : data.description ? (
            <p className="text-sm text-warm leading-relaxed whitespace-pre-wrap">
              {data.description}
            </p>
          ) : (
            <div className="text-sm text-warm-muted">Brak opisu dla tej książki.</div>
          )}
          {url && (
            <a
              href={url}
              target="_blank"
              rel="noreferrer"
              className="mt-3 inline-flex items-center gap-1 text-xs text-warm-muted hover:text-warm"
            >
              <ExternalLink className="w-3 h-3" /> Zobacz źródło ({sourceLabel(data.source)})
            </a>
          )}
        </div>
        {dup && (
          <div className="mx-5 mb-3 glass rounded-2xl p-3 text-xs text-warm">
            Ta książka jest już w bibliotece ({dup.title}).
          </div>
        )}
        <div className="sticky bottom-0 px-5 py-3 bg-[var(--bg)]/80 backdrop-blur border-t border-[var(--glass-border)] flex gap-2 flex-wrap justify-end">
          <button onClick={onClose} className="px-4 py-2 rounded-full glass text-warm text-sm">
            Zamknij
          </button>
          <button
            onClick={() => onAdd(data)}
            className="px-4 py-2 rounded-full bg-[var(--accent-gold)] text-[var(--bg)] text-sm font-medium"
          >
            Dodaj do biblioteki
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------- ISBN ----------
function IsbnTab() {
  const [isbn, setIsbn] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<BookSearchResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dup, setDup] = useState<Book | null>(null);

  useEffect(() => {
    const handler = (e: Event) => {
      const ce = e as CustomEvent<string>;
      if (typeof ce.detail === "string") setIsbn(ce.detail);
    };
    window.addEventListener("agata-prefill-isbn", handler);
    return () => window.removeEventListener("agata-prefill-isbn", handler);
  }, []);

  const router = useRouter();

  const clean = isbn.replace(/[^0-9Xx]/g, "");
  const valid = clean.length === 10 || clean.length === 13;

  const lookup = async () => {
    setError(null);
    setResult(null);
    setDup(null);
    if (!valid) {
      setError("Nieprawidłowy numer ISBN");
      return;
    }
    const existing = isDuplicateBook({ isbn: clean });
    if (existing) {
      setDup(existing);
      return;
    }
    setLoading(true);
    try {
      const r = await lookupByIsbn(clean);
      if (!r) setError("Nie znaleziono książki dla tego ISBN");
      else setResult(r);
    } catch {
      setError("Nie udało się wyszukać książek. Spróbuj ponownie.");
    } finally {
      setLoading(false);
    }
  };

  const add = (force = false) => {
    if (!result) return;
    const existing =
      !force &&
      isDuplicateBook({ isbn: result.isbn || clean, title: result.title, author: result.author });
    if (existing) {
      setDup(existing);
      return;
    }
    const res = createBook({
      title: result.title,
      author: result.author,
      isbn: result.isbn || clean,
      cover_url: result.cover_url,
      description: result.description,
      pageCount: result.page_count || 0,
      publishedDate: result.published_date,
      genre: result.category,
      publisher: result.publisher,
      language: result.language,
      status: "queue",
      source: "isbn",
    });
    if (res.ok && res.book) router.navigate({ to: "/book/$id", params: { id: res.book.id } });
    else setError(res.error || "Nie udało się zapisać książki.");
  };

  return (
    <div className="space-y-4">
      <div className="glass rounded-2xl p-3 flex gap-2">
        <input
          value={isbn}
          onChange={(e) => setIsbn(e.target.value)}
          placeholder="Numer ISBN"
          inputMode="numeric"
          className="flex-1 bg-[var(--glass-inner)] rounded-xl px-4 py-2.5 text-sm text-warm focus:outline-none"
        />
        <button
          onClick={lookup}
          disabled={loading}
          className="px-4 py-2.5 rounded-xl bg-[var(--accent-gold)] text-[var(--bg)] text-sm font-medium disabled:opacity-50 inline-flex items-center gap-1.5"
        >
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Hash className="w-4 h-4" />}
          Sprawdź ISBN
        </button>
      </div>
      {error && <div className="text-sm text-rose-500">{error}</div>}
      {dup && (
        <div className="glass rounded-2xl p-4 space-y-3">
          <div className="font-serif text-warm">Ta książka jest już w bibliotece</div>
          <div className="text-sm text-warm-muted">
            {dup.title} — {dup.author}
          </div>
          <div className="flex gap-2 flex-wrap">
            <Link
              to="/book/$id"
              params={{ id: dup.id }}
              className="px-3 py-1.5 rounded-full bg-[var(--accent-gold)] text-[var(--bg)] text-xs"
            >
              Otwórz książkę
            </Link>
            {result && (
              <button
                onClick={() => add(true)}
                className="px-3 py-1.5 rounded-full glass text-warm text-xs"
              >
                Dodaj mimo to
              </button>
            )}
          </div>
        </div>
      )}
      {result && !dup && <IsbnResultCard result={result} onAdd={() => add(false)} />}
    </div>
  );
}

function IsbnResultCard({ result, onAdd }: { result: BookSearchResult; onAdd: () => void }) {
  const [showDetails, setShowDetails] = useState(false);
  return (
    <>
      <div className="glass rounded-2xl p-4 flex gap-3">
        <button
          type="button"
          onClick={() => setShowDetails(true)}
          className="w-[80px] h-[120px] rounded-lg overflow-hidden bg-[var(--glass-inner)] shrink-0 grid place-items-center hover:opacity-80"
          aria-label="Pokaż szczegóły"
        >
          {result.cover_url ? (
            <img src={result.cover_url} alt="" className="w-full h-full object-cover" />
          ) : (
            <span className="text-[10px] text-warm-muted">Brak okładki</span>
          )}
        </button>
        <div className="flex-1 min-w-0">
          <div className="font-serif text-warm">{result.title}</div>
          <div className="text-xs text-warm-muted">{result.author}</div>
          <div className="text-[11px] text-warm-muted mt-1">
            {[result.published_date, result.page_count ? `${result.page_count} s.` : null]
              .filter(Boolean)
              .join(" · ") || "Brak danych"}
          </div>
          <div className="mt-2 flex gap-2 flex-wrap">
            <button
              onClick={() => setShowDetails(true)}
              className="px-3 py-1.5 rounded-full glass text-warm text-xs font-medium inline-flex items-center gap-1"
            >
              <Info className="w-3.5 h-3.5" /> Szczegóły
            </button>
            <button
              onClick={onAdd}
              className="px-3 py-1.5 rounded-full bg-[var(--accent-gold)] text-[var(--bg)] text-xs font-medium"
            >
              Dodaj do biblioteki
            </button>
          </div>
        </div>
      </div>
      {showDetails && (
        <BookDetailsModal
          initial={result}
          onClose={() => setShowDetails(false)}
          onAdd={() => {
            setShowDetails(false);
            onAdd();
          }}
        />
      )}
    </>
  );
}

// ---------- Scan ----------
interface WindowWithBD extends Window {
  BarcodeDetector?: new (opts?: { formats?: string[] }) => {
    detect: (src: CanvasImageSource) => Promise<{ rawValue: string }[]>;
  };
}

function ScanTab({ onIsbn }: { onIsbn: (v: string) => void }) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number | null>(null);
  const [running, setRunning] = useState(false);
  const [supported, setSupported] = useState<boolean | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [found, setFound] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const w = window as WindowWithBD;
    setSupported(typeof w.BarcodeDetector === "function" && !!navigator.mediaDevices?.getUserMedia);
    return () => stop();
  }, []);

  const stop = () => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setRunning(false);
  };

  const start = async () => {
    setError(null);
    setFound(null);
    const w = window as WindowWithBD;
    if (!w.BarcodeDetector || !navigator.mediaDevices?.getUserMedia) {
      setError("Skanowanie kodu nie jest wspierane w tej przeglądarce. Wpisz ISBN ręcznie.");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setRunning(true);
      const detector = new w.BarcodeDetector({ formats: ["ean_13", "ean_8", "isbn_13"] });
      const tick = async () => {
        if (!videoRef.current || !streamRef.current) return;
        try {
          const codes = await detector.detect(videoRef.current);
          const ean = codes.find((c) => /^\d{10,13}$/.test(c.rawValue));
          if (ean) {
            setFound(ean.rawValue);
            stop();
            return;
          }
        } catch {
          /* ignore frame errors */
        }
        rafRef.current = requestAnimationFrame(tick);
      };
      rafRef.current = requestAnimationFrame(tick);
    } catch {
      setError("Aparat nie jest dostępny na tym urządzeniu.");
      stop();
    }
  };

  if (supported === false) {
    return (
      <div className="space-y-3">
        <div className="glass rounded-2xl p-5 text-sm text-warm-muted">
          Skanowanie kodu nie jest wspierane w tej przeglądarce. Wpisz ISBN ręcznie.
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="glass rounded-2xl p-3">
        <div className="aspect-[4/3] w-full rounded-xl overflow-hidden bg-black/40 grid place-items-center relative">
          <video ref={videoRef} playsInline muted className="w-full h-full object-cover" />
          {!running && <div className="absolute text-xs text-white/70">Skanuj ISBN</div>}
        </div>
        <div className="flex gap-2 mt-3 flex-wrap">
          {!running ? (
            <button
              onClick={start}
              className="px-4 py-2 rounded-full bg-[var(--accent-gold)] text-[var(--bg)] text-sm inline-flex items-center gap-1.5"
            >
              <Camera className="w-4 h-4" /> Uruchom kamerę
            </button>
          ) : (
            <button
              onClick={stop}
              className="px-4 py-2 rounded-full glass text-warm text-sm inline-flex items-center gap-1.5"
            >
              <CameraOff className="w-4 h-4" /> Zatrzymaj kamerę
            </button>
          )}
        </div>
      </div>
      {error && <div className="text-sm text-rose-500">{error}</div>}
      {found && (
        <div className="glass rounded-2xl p-4 space-y-3">
          <div className="text-warm">
            Znaleziono ISBN: <span className="font-mono">{found}</span>
          </div>
          <button
            onClick={() => onIsbn(found)}
            className="px-4 py-2 rounded-full bg-[var(--accent-gold)] text-[var(--bg)] text-sm"
          >
            Sprawdź znaleziony ISBN
          </button>
        </div>
      )}
    </div>
  );
}

// ---------- Manual ----------
function ManualTab() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [author, setAuthor] = useState("");
  const [isbn, setIsbn] = useState("");
  const [description, setDescription] = useState("");
  const [pageCount, setPageCount] = useState("");
  const [publishedDate, setPublishedDate] = useState("");
  const [genre, setGenre] = useState("");
  const [publisher, setPublisher] = useState("");
  const [seriesName, setSeriesName] = useState("");
  const [seriesPart, setSeriesPart] = useState("");
  const [tags, setTags] = useState("");
  const [coverUrl, setCoverUrl] = useState("");
  const [coverData, setCoverData] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dup, setDup] = useState<Book | null>(null);
  const [busy, setBusy] = useState(false);

  const onCover = async (file: File) => {
    setError(null);
    try {
      const r = await compressCoverFile(file);
      setCoverData(r.dataUrl);
    } catch {
      setError("Nie udało się dodać okładki. Spróbuj wybrać mniejszy plik.");
    }
  };

  const submit = (force = false) => {
    setError(null);
    if (!title.trim()) {
      setError("Tytuł jest wymagany");
      return;
    }
    if (!author.trim()) {
      setError("Autor jest wymagany");
      return;
    }
    const existing = !force && isDuplicateBook({ isbn, title, author });
    if (existing) {
      setDup(existing);
      return;
    }
    setBusy(true);
    const res = createBook({
      title,
      author,
      isbn,
      cover_url: coverData || coverUrl || null,
      description,
      pageCount: Number(pageCount) || 0,
      publishedDate,
      genre,
      publisher,
      seriesName,
      seriesPart,
      tags: tags
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean),
      status: "queue",
      source: "manual",
    });
    setBusy(false);
    if (res.ok && res.book) {
      router.navigate({ to: "/book/$id", params: { id: res.book.id } });
    } else {
      setError(res.error || "Nie udało się zapisać książki.");
    }
  };

  return (
    <div className="space-y-3">
      <Field label="Tytuł">
        <input value={title} onChange={(e) => setTitle(e.target.value)} className={input} />
      </Field>
      <Field label="Autor">
        <input value={author} onChange={(e) => setAuthor(e.target.value)} className={input} />
      </Field>
      <Field label="ISBN">
        <input value={isbn} onChange={(e) => setIsbn(e.target.value)} className={input} />
      </Field>
      <Field label="Opis">
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={3}
          className={input}
        />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Liczba stron">
          <input
            value={pageCount}
            onChange={(e) => setPageCount(e.target.value)}
            inputMode="numeric"
            className={input}
          />
        </Field>
        <Field label="Data wydania">
          <input
            value={publishedDate}
            onChange={(e) => setPublishedDate(e.target.value)}
            className={input}
          />
        </Field>
      </div>
      <Field label="Gatunek">
        <input value={genre} onChange={(e) => setGenre(e.target.value)} className={input} />
      </Field>
      <Field label="Wydawnictwo">
        <input value={publisher} onChange={(e) => setPublisher(e.target.value)} className={input} />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Seria">
          <input
            value={seriesName}
            onChange={(e) => setSeriesName(e.target.value)}
            className={input}
          />
        </Field>
        <Field label="Część serii">
          <input
            value={seriesPart}
            onChange={(e) => setSeriesPart(e.target.value)}
            className={input}
          />
        </Field>
      </div>
      <Field label="Tagi">
        <input
          value={tags}
          onChange={(e) => setTags(e.target.value)}
          placeholder="oddziel przecinkiem"
          className={input}
        />
      </Field>
      <Field label="Okładka">
        <div className="space-y-2">
          <input
            value={coverUrl}
            onChange={(e) => setCoverUrl(e.target.value)}
            placeholder="URL okładki"
            className={input}
          />
          <label className="inline-flex items-center gap-2 px-3 py-2 rounded-xl glass text-warm text-sm cursor-pointer w-fit">
            <Upload className="w-4 h-4" /> Dodaj własną okładkę
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) onCover(f);
              }}
            />
          </label>
          {(coverData || coverUrl) && (
            <div className="relative w-[80px] h-[120px] rounded-lg overflow-hidden bg-[var(--glass-inner)]">
              <img src={coverData || coverUrl} alt="" className="w-full h-full object-cover" />
              {coverData && (
                <button
                  type="button"
                  onClick={() => setCoverData(null)}
                  className="absolute top-1 right-1 w-5 h-5 rounded-full bg-black/60 text-white grid place-items-center"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>
          )}
        </div>
      </Field>

      {error && <div className="text-sm text-rose-500">{error}</div>}
      {dup && (
        <div className="glass rounded-2xl p-4 space-y-3">
          <div className="font-serif text-warm">Ta książka jest już w bibliotece</div>
          <div className="flex gap-2 flex-wrap">
            <Link
              to="/book/$id"
              params={{ id: dup.id }}
              className="px-3 py-1.5 rounded-full bg-[var(--accent-gold)] text-[var(--bg)] text-xs"
            >
              Otwórz książkę
            </Link>
            <button
              onClick={() => submit(true)}
              className="px-3 py-1.5 rounded-full glass text-warm text-xs"
            >
              Dodaj mimo to
            </button>
            <button
              onClick={() => setDup(null)}
              className="px-3 py-1.5 rounded-full glass text-warm text-xs"
            >
              Anuluj
            </button>
          </div>
        </div>
      )}

      <div className="pt-2">
        <button
          onClick={() => submit(false)}
          disabled={busy}
          className="w-full py-3 rounded-full bg-[var(--accent-gold)] text-[var(--bg)] font-medium disabled:opacity-50"
        >
          {busy ? "Zapisywanie…" : "Zapisz"}
        </button>
      </div>
    </div>
  );
}

const input =
  "w-full bg-[var(--glass-inner)] rounded-xl px-3.5 py-2.5 text-sm text-warm focus:outline-none";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-[11px] uppercase tracking-wider text-warm-muted">{label}</span>
      <div className="mt-1">{children}</div>
    </label>
  );
}
