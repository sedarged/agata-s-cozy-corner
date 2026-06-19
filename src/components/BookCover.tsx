import { cn } from "@/lib/utils";
import { gradientFor, paletteFor } from "@/lib/cover";
import { useMemo, useState } from "react";

interface BookLike {
  id?: string;
  title: string;
  author?: string | null;
  cover_url?: string | null;
  coverGradient?: string;
  coverAccent?: string;
}

interface Props {
  book: BookLike;
  className?: string;
  size?: "sm" | "md" | "lg" | "xl";
}

const sizes = {
  sm: "w-16 h-24 text-[8px]",
  md: "w-24 h-36 text-[10px]",
  lg: "w-36 h-52 text-xs",
  xl: "w-48 h-72 text-sm",
};

const illustratedTitles = new Set([
  "Zanim wystygnie kawa",
  "Małe cuda z zakładu pogrzebowego",
  "Słowik",
  "Północna biblioteka",
  "Gdzie śpiewają raki",
  "Siedem sióstr",
  "Cztery wiatry",
  "Atlas szepczących chmur",
  "Dom przy ulicy Amélie",
  "Nocny ogród",
]);

function Illustration({ title }: { title: string }) {
  switch (title) {
    case "Zanim wystygnie kawa":
      return (
        <>
          <div className="absolute inset-0 bg-linear-to-b from-[#d7ecef] via-[#b1d0d8] to-[#7a8f95]" />
          <div className="absolute inset-x-0 bottom-0 h-[36%] bg-linear-to-b from-transparent to-[#435056]/55" />
          <div className="absolute left-[10%] top-[12%] w-[70%] h-[58%] rounded-[40%] bg-white/18 blur-md" />
          <div className="absolute right-[9%] bottom-[16%] w-[24%] h-[12%] rounded-full border border-[#6d5a47]/40 bg-[#e9dcc8]" />
          <div className="absolute right-[15%] bottom-[22%] w-[12%] h-[8%] rounded-full border border-[#6d5a47]/50 bg-[#e8d5bd]" />
          <div className="absolute right-[8%] bottom-[18%] w-[5%] h-[8%] rounded-r-full border border-[#6d5a47]/40 border-l-0" />
        </>
      );
    case "Małe cuda z zakładu pogrzebowego":
      return (
        <>
          <div className="absolute inset-0 bg-linear-to-b from-[#dfe8e2] via-[#cfded7] to-[#b9cfc7]" />
          {Array.from({ length: 8 }).map((_, i) => (
            <div
              key={i}
              className="absolute rounded-full bg-[#f7f2e8] border border-[#e2d5bf]/70"
              style={{
                width: 18 + (i % 3) * 7,
                height: 18 + (i % 3) * 7,
                left: `${8 + i * 10}%`,
                top: `${8 + (i % 2) * 12}%`,
              }}
            />
          ))}
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(255,255,255,0.55),transparent_36%),radial-gradient(circle_at_80%_84%,rgba(255,255,255,0.35),transparent_30%)]" />
        </>
      );
    case "Słowik":
      return (
        <>
          <div className="absolute inset-0 bg-linear-to-b from-[#f3e7d5] via-[#eadfc7] to-[#cab58a]" />
          {Array.from({ length: 10 }).map((_, i) => (
            <div
              key={i}
              className="absolute rounded-full bg-[#fff7e8] border border-[#d8c7a7]/60"
              style={{
                width: 20 + (i % 4) * 6,
                height: 20 + (i % 4) * 6,
                left: `${4 + i * 9}%`,
                bottom: `${-1 + (i % 3) * 7}%`,
              }}
            />
          ))}
          <div className="absolute left-[46%] bottom-[24%] w-[7%] h-[15%] bg-[#4e3926] rounded-t-full" />
          <div className="absolute left-[43%] bottom-[34%] w-[13%] h-[9%] rounded-full bg-[#356270] rotate-[-18deg]" />
        </>
      );
    case "Północna biblioteka":
      return (
        <>
          <div className="absolute inset-0 bg-linear-to-b from-[#0f2339] via-[#081525] to-[#0d1320]" />
          {Array.from({ length: 9 }).map((_, i) => (
            <div
              key={i}
              className="absolute rounded-full bg-[#d7b36d]"
              style={{
                width: i % 3 === 0 ? 3 : 2,
                height: i % 3 === 0 ? 3 : 2,
                left: `${10 + i * 9}%`,
                top: `${8 + (i % 4) * 8}%`,
              }}
            />
          ))}
          <div className="absolute left-[38%] bottom-[18%] w-[24%] h-[24%] bg-[#e9cc8d] [clip-path:polygon(50%_0%,100%_18%,100%_100%,0_100%,0_18%)] shadow-[0_0_18px_rgba(233,204,141,0.35)]" />
          <div className="absolute left-[44%] bottom-[22%] w-[6%] h-[12%] bg-[#0f2339]" />
        </>
      );
    case "Gdzie śpiewają raki":
      return (
        <>
          <div className="absolute inset-0 bg-linear-to-b from-[#ebd2c0] via-[#d6b4a0] to-[#6f5b4b]" />
          <div className="absolute inset-x-0 bottom-[18%] h-[1px] bg-white/25" />
          {Array.from({ length: 7 }).map((_, i) => (
            <div
              key={i}
              className="absolute w-[2px] rounded-full bg-[#5a4a3c]/70"
              style={{
                height: `${18 + (i % 3) * 10}%`,
                right: `${6 + i * 7}%`,
                bottom: `${15 + (i % 2) * 2}%`,
                transform: `rotate(${8 - i * 3}deg)`,
              }}
            />
          ))}
        </>
      );
    case "Siedem sióstr":
      return (
        <>
          <div className="absolute inset-0 bg-linear-to-b from-[#d9bfd5] via-[#c9b1d8] to-[#5c486d]" />
          <div className="absolute inset-x-0 bottom-0 h-[34%] bg-[#7f638f]" />
          {Array.from({ length: 10 }).map((_, i) => (
            <div
              key={i}
              className="absolute w-[5%] h-[22%] bg-[#7d547b] rounded-t-full"
              style={{ left: `${2 + i * 9}%`, bottom: 0 }}
            />
          ))}
        </>
      );
    case "Cztery wiatry":
      return (
        <>
          <div className="absolute inset-0 bg-linear-to-b from-[#20352d] via-[#10231d] to-[#11130f]" />
          {Array.from({ length: 11 }).map((_, i) => (
            <div
              key={i}
              className="absolute rounded-full border border-[#b99b64]/55"
              style={{
                width: 16 + (i % 3) * 8,
                height: 16 + (i % 3) * 8,
                left: `${3 + (i % 4) * 21}%`,
                top: `${6 + Math.floor(i / 4) * 21}%`,
              }}
            />
          ))}
          <div className="absolute left-[42%] bottom-[10%] w-[16%] h-[16%] bg-[#d1b16d]/90" />
        </>
      );
    case "Atlas szepczących chmur":
      return (
        <>
          <div className="absolute inset-0 bg-linear-to-b from-[#5b7590] via-[#425b75] to-[#223447]" />
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_22%,rgba(255,255,255,0.2),transparent_25%),radial-gradient(circle_at_70%_30%,rgba(255,255,255,0.12),transparent_20%)]" />
        </>
      );
    case "Dom przy ulicy Amélie":
      return (
        <>
          <div className="absolute inset-0 bg-linear-to-b from-[#2f573e] via-[#31543f] to-[#1f3427]" />
          <div className="absolute left-[20%] top-[30%] w-[56%] h-[40%] border border-[#d6c4a2]/30 bg-[#264432]/55" />
          <div className="absolute left-[42%] top-[38%] w-[12%] h-[32%] border border-[#cdb28c]/35" />
          {Array.from({ length: 7 }).map((_, i) => (
            <div
              key={i}
              className="absolute rounded-full bg-[#b17982]/55"
              style={{ width: 7, height: 7, left: `${18 + i * 9}%`, top: `${10 + (i % 3) * 6}%` }}
            />
          ))}
        </>
      );
    case "Nocny ogród":
      return (
        <>
          <div className="absolute inset-0 bg-linear-to-b from-[#20261f] via-[#121611] to-[#090c08]" />
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_20%,rgba(154,177,138,0.15),transparent_28%),radial-gradient(circle_at_20%_85%,rgba(154,177,138,0.1),transparent_22%)]" />
        </>
      );
    default:
      return null;
  }
}

function IllustratedFallback({
  book,
  size,
  className,
}: {
  book: BookLike;
  size: Props["size"];
  className?: string;
}) {
  const titleClass = useMemo(() => {
    if (book.title === "Północna biblioteka") return "text-[0.82em]";
    if (book.title === "Małe cuda z zakładu pogrzebowego") return "text-[0.7em]";
    if (book.title === "Gdzie śpiewają raki") return "text-[0.8em]";
    return "text-[0.84em]";
  }, [book.title]);

  return (
    <div
      className={cn(
        "relative isolate shrink-0 rounded-[4px] book-shadow overflow-hidden",
        sizes[size ?? "md"],
        className,
      )}
    >
      <Illustration title={book.title} />
      <div className="absolute inset-0 bg-linear-to-b from-white/10 via-transparent to-black/8" />
      <div className="relative z-10 h-full p-[10%] flex flex-col justify-between">
        <div
          className={cn("font-serif leading-[1.02] tracking-[0.06em] text-center", titleClass)}
          style={{
            color: [
              "Północna biblioteka",
              "Cztery wiatry",
              "Nocny ogród",
              "Atlas szepczących chmur",
            ].includes(book.title)
              ? "#f2ddb2"
              : "#3d2b1f",
          }}
        >
          {book.title}
        </div>
        {book.author && (
          <div
            className="text-center uppercase tracking-[0.16em] opacity-85"
            style={{
              fontSize: "0.48em",
              color: [
                "Północna biblioteka",
                "Cztery wiatry",
                "Nocny ogród",
                "Atlas szepczących chmur",
              ].includes(book.title)
                ? "#e6c894"
                : "#705645",
            }}
          >
            {book.author}
          </div>
        )}
      </div>
    </div>
  );
}

export function BookCover({ book, className, size = "md" }: Props) {
  const [errored, setErrored] = useState(false);
  const coverUrl = book.cover_url ?? undefined;
  const palette = paletteFor(book.title);
  const bg = book.coverGradient ?? gradientFor(book.title);
  const accent = book.coverAccent ?? palette.accent;
  const showImage = coverUrl && !errored;

  if (showImage) {
    return (
      <div
        className={cn(
          "relative shrink-0 rounded-[6px] book-shadow overflow-hidden bg-muted",
          sizes[size],
          className,
        )}
      >
        <img
          src={coverUrl}
          alt={book.title}
          loading="lazy"
          className="w-full h-full object-cover"
          onError={() => setErrored(true)}
        />
        <div className="absolute inset-0 pointer-events-none bg-[linear-gradient(115deg,rgba(255,255,255,0.22)_0%,transparent_24%,transparent_76%,rgba(0,0,0,0.18)_100%)]" />
        <div className="absolute inset-y-0 left-0 w-[3px] bg-[linear-gradient(90deg,rgba(0,0,0,0.35),transparent)] pointer-events-none" />
      </div>
    );
  }

  if (illustratedTitles.has(book.title)) {
    return <IllustratedFallback book={book} size={size} className={className} />;
  }

  return (
    <div
      className={cn(
        "relative shrink-0 rounded-[6px] book-shadow overflow-hidden flex flex-col justify-between p-2",
        sizes[size],
        className,
      )}
      style={{ background: bg, color: accent }}
    >
      <div className="font-serif font-semibold leading-tight" style={{ fontSize: "0.85em" }}>
        {book.title}
      </div>
      <div className="flex justify-center items-center flex-1 opacity-25">
        <svg viewBox="0 0 40 40" className="w-1/2 h-1/2">
          <path fill="currentColor" d="M20 4l5 12h13l-10.5 8 4 12L20 28l-11.5 8 4-12L2 16h13z" />
        </svg>
      </div>
      {book.author && (
        <div className="opacity-80 tracking-wide" style={{ fontSize: "0.65em" }}>
          {book.author}
        </div>
      )}
    </div>
  );
}
