import { createFileRoute, Link } from "@tanstack/react-router";
import { PageHeader } from "@/components/PageHeader";
import { BookCover } from "@/components/BookCover";
import { useState } from "react";
import { getYearlyStats, formatMinutes } from "@/lib/stats";
import { pluralPL } from "@/lib/utils";
import { useWorkspaceVersion } from "@/lib/book-workspace-store";
import { useBooksVersion } from "@/lib/books-store";
import { useNotesVersion } from "@/lib/notes-store";
import { Sparkles, Share2, Download } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/year-in-review")({
  head: () => ({ meta: [{ title: "Rok w czytaniu — Agata" }] }),
  component: YearInReview,
});

function YearInReview() {
  useWorkspaceVersion();
  useBooksVersion();
  useNotesVersion();

  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState(currentYear);
  const data = getYearlyStats(year);
  const years = [currentYear, currentYear - 1, currentYear - 2];

  const shareText = () => {
    const lines = [
      `📚 Mój rok w czytaniu ${year} — Agata`,
      `Ukończone książki: ${data.booksFinishedCount}`,
      `Przeczytane strony: ${data.totalPages.toLocaleString("pl-PL")}`,
      `Czas czytania: ${formatMinutes(data.totalMinutes)}`,
      `Dni z czytaniem: ${data.daysRead}`,
    ];
    if (data.topRated[0])
      lines.push(`Top książka: „${data.topRated[0].title}" — ${data.topRated[0].author}`);
    return lines.join("\n");
  };

  const handleShare = async () => {
    const text = shareText();
    try {
      if (navigator.share) {
        await navigator.share({ title: `Rok w czytaniu ${year}`, text });
        return;
      }
    } catch {
      /* fall through */
    }
    try {
      await navigator.clipboard.writeText(text);
      toast.success("Podsumowanie skopiowane do schowka");
    } catch {
      toast.error("Nie udało się udostępnić");
    }
  };

  const downloadImage = async () => {
    try {
      // Ensure the serif web font is loaded so the exported image matches the
      // on-screen design (otherwise canvas silently falls back to Georgia).
      try {
        await document.fonts?.ready;
      } catch {
        /* fonts API unavailable — Georgia fallback in font strings applies */
      }
      const W = 1080;
      const H = 1080;
      const canvas = document.createElement("canvas");
      canvas.width = W;
      canvas.height = H;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      // Background gradient
      const g = ctx.createLinearGradient(0, 0, 0, H);
      g.addColorStop(0, "#f5ede2");
      g.addColorStop(1, "#e8d6b8");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, H);

      ctx.fillStyle = "#3a1018";
      ctx.font = "italic 64px 'Cormorant Garamond', Georgia, serif";
      ctx.textAlign = "center";
      ctx.fillText("Rok w czytaniu", W / 2, 130);
      ctx.fillStyle = "#8a6b3a";
      ctx.font = "500 110px 'Cormorant Garamond', Georgia, serif";
      ctx.fillText(String(year), W / 2, 240);

      // Numbers grid
      const cells: Array<[string, string]> = [
        [String(data.booksFinishedCount), "książek"],
        [data.totalPages.toLocaleString("pl-PL"), "stron"],
        [formatMinutes(data.totalMinutes), "czytania"],
        [String(data.daysRead), "dni"],
      ];
      const cw = (W - 160) / 2;
      const ch = 200;
      cells.forEach(([v, l], i) => {
        const x = 80 + (i % 2) * cw;
        const y = 320 + Math.floor(i / 2) * (ch + 24);
        ctx.fillStyle = "rgba(255,255,255,0.55)";
        ctx.beginPath();
        const r = 32;
        ctx.moveTo(x + r, y);
        ctx.arcTo(x + cw, y, x + cw, y + ch, r);
        ctx.arcTo(x + cw, y + ch, x, y + ch, r);
        ctx.arcTo(x, y + ch, x, y, r);
        ctx.arcTo(x, y, x + cw, y, r);
        ctx.closePath();
        ctx.fill();

        ctx.fillStyle = "#3a1018";
        ctx.font = "600 72px 'Cormorant Garamond', Georgia, serif";
        ctx.textAlign = "center";
        ctx.fillText(v, x + cw / 2, y + 110);
        ctx.fillStyle = "#8a6b3a";
        ctx.font = "500 28px 'Inter', system-ui, sans-serif";
        ctx.fillText(l.toUpperCase(), x + cw / 2, y + 160);
      });

      // Top book
      const top = data.topRated[0];
      if (top) {
        ctx.fillStyle = "#3a1018";
        ctx.font = "italic 40px 'Cormorant Garamond', Georgia, serif";
        ctx.textAlign = "center";
        const t = `Top: „${top.title}"`;
        ctx.fillText(t.length > 40 ? t.slice(0, 38) + "…" : t, W / 2, 820);
        ctx.fillStyle = "#8a6b3a";
        ctx.font = "500 28px 'Inter', system-ui, sans-serif";
        ctx.fillText(top.author, W / 2, 870);
      }

      ctx.fillStyle = "#8a6b3a";
      ctx.font = "500 24px 'Inter', system-ui, sans-serif";
      ctx.fillText("Agata · prywatna biblioteka", W / 2, 1010);

      canvas.toBlob((blob) => {
        if (!blob) {
          toast.error("Nie udało się wygenerować obrazu.");
          return;
        }
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `agata-rok-${year}.png`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
      }, "image/png");
    } catch {
      toast.error("Nie udało się wygenerować obrazu.");
    }
  };

  const hasAnyData =
    data.totalMinutes > 0 ||
    data.totalPages > 0 ||
    data.booksFinishedCount > 0 ||
    data.favouriteQuotes.length > 0;

  return (
    <div>
      <PageHeader
        title="Rok w czytaniu"
        subtitle={`Twoje czytelnicze podsumowanie roku ${year}.`}
      />
      <div className="px-5 lg:px-10 pb-12 space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex gap-2">
            {years.map((y) => (
              <button
                key={y}
                onClick={() => setYear(y)}
                className={`px-4 py-2 rounded-xl text-sm transition ${
                  y === year ? "bg-primary text-primary-foreground" : "bg-card hover:bg-muted"
                }`}
              >
                {y}
              </button>
            ))}
          </div>
          <div className="flex gap-2 flex-wrap">
            <button
              onClick={handleShare}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-card hover:bg-muted text-sm"
            >
              <Share2 className="w-4 h-4" aria-hidden="true" />
              Udostępnij
            </button>
            <button
              onClick={downloadImage}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-primary text-primary-foreground hover:opacity-90 text-sm"
            >
              <Download className="w-4 h-4" aria-hidden="true" />
              Pobierz obraz podsumowania
            </button>
          </div>
        </div>

        {!hasAnyData ? (
          <div className="bg-card rounded-3xl p-10 shadow-soft text-center space-y-3">
            <Sparkles className="w-10 h-10 mx-auto text-primary" />
            <h3 className="font-serif text-xl">Jeszcze niewiele danych za {year}</h3>
            <p className="text-sm text-muted-foreground max-w-md mx-auto">
              Dodaj sesje czytania, oznacz ukończone książki i zapisuj cytaty. Podsumowanie wypełni
              się samo.
            </p>
            <Link
              to="/library"
              className="inline-block mt-3 px-5 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm"
            >
              Otwórz bibliotekę
            </Link>
          </div>
        ) : (
          <>
            {/* Hero numbers */}
            <div className="bg-gradient-to-br from-primary/15 to-primary/5 rounded-3xl p-8 shadow-soft">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
                <Big v={data.booksFinishedCount} l={pluralPL(data.booksFinishedCount, "ukończona książka", "ukończone książki", "ukończonych książek")} />
                <Big v={data.totalPages.toLocaleString("pl-PL")} l="stron przeczytanych" />
                <Big v={formatMinutes(data.totalMinutes)} l="czytania" />
                <Big v={data.daysRead} l={pluralPL(data.daysRead, "dzień z czytaniem", "dni z czytaniem", "dni z czytaniem")} />
              </div>
            </div>

            {/* Top rated */}
            {data.topRated.length > 0 && (
              <div className="bg-card rounded-3xl p-6 shadow-soft">
                <h3 className="font-serif text-lg mb-4">Top książki roku</h3>
                <div className="grid sm:grid-cols-2 gap-3">
                  {data.topRated.map((b) => (
                    <Link
                      key={b.id}
                      to="/book/$id"
                      params={{ id: b.id }}
                      className="flex items-center gap-3 p-3 rounded-2xl bg-muted/40 hover:bg-muted transition"
                    >
                      <BookCover book={b} size="sm" className="!w-12 !h-16" />
                      <div className="flex-1 min-w-0">
                        <div className="font-medium line-clamp-1">{b.title}</div>
                        <div className="text-xs text-muted-foreground">{b.author}</div>
                      </div>
                      <div className="font-serif text-xl">{b.rating}/10</div>
                    </Link>
                  ))}
                </div>
              </div>
            )}

            {/* Finished list */}
            {data.finishedBooks.length > 0 && (
              <div className="bg-card rounded-3xl p-6 shadow-soft">
                <h3 className="font-serif text-lg mb-4">
                  Wszystkie ukończone w {year} ({data.finishedBooks.length})
                </h3>
                <div className="flex gap-3 overflow-x-auto pb-2 -mx-1 px-1">
                  {data.finishedBooks.map((b) => (
                    <Link
                      key={b.id}
                      to="/book/$id"
                      params={{ id: b.id }}
                      className="flex-shrink-0 w-24"
                    >
                      <BookCover book={b} size="sm" className="!w-24 !h-32" />
                      <div className="text-xs mt-1.5 line-clamp-2">{b.title}</div>
                    </Link>
                  ))}
                </div>
              </div>
            )}

            {/* Favourite quotes */}
            {data.favouriteQuotes.length > 0 && (
              <div className="bg-card rounded-3xl p-6 shadow-soft">
                <h3 className="font-serif text-lg mb-4">Ulubione cytaty</h3>
                <div className="space-y-4">
                  {data.favouriteQuotes.map((q) => (
                    <blockquote
                      key={q.id}
                      className="border-l-2 border-primary pl-4 italic text-sm leading-relaxed"
                    >
                      „{q.quoteText ?? q.content}"
                      {q.pageNumber && (
                        <div className="not-italic text-xs text-muted-foreground mt-1">
                          s. {q.pageNumber}
                        </div>
                      )}
                    </blockquote>
                  ))}
                </div>
              </div>
            )}

            {/* Top tags */}
            {data.topTags.length > 0 && (
              <div className="bg-card rounded-3xl p-6 shadow-soft">
                <h3 className="font-serif text-lg mb-4">Tematy roku</h3>
                <div className="flex flex-wrap gap-2">
                  {data.topTags.map(({ tag, count }, i) => (
                    <span
                      key={tag}
                      className="px-3 py-1.5 rounded-full bg-muted text-sm"
                      style={{ fontSize: `${Math.max(0.8, 1.1 - i * 0.04)}rem` }}
                    >
                      {tag} <span className="text-muted-foreground">·{count}</span>
                    </span>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function Big({ v, l }: { v: string | number; l: string }) {
  return (
    <div>
      <div className="font-serif text-3xl md:text-4xl">{v}</div>
      <div className="text-[11px] uppercase tracking-widest text-muted-foreground mt-1">{l}</div>
    </div>
  );
}
