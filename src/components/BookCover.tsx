import { cn } from "@/lib/utils";
import { gradientFor, paletteFor } from "@/lib/cover";
import { useState } from "react";

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

export function BookCover({ book, className, size = "md" }: Props) {
  const [errored, setErrored] = useState(false);
  const coverUrl = book.cover_url ?? undefined;
  const palette = paletteFor(book.title);
  const bg = book.coverGradient ?? gradientFor(book.title);
  const accent = book.coverAccent ?? palette.accent;

  const showImage = coverUrl && !errored;

  if (showImage) {
    return (
      <div className={cn("relative shrink-0 rounded-[3px] book-shadow overflow-hidden bg-muted", sizes[size], className)}>
        <img
          src={coverUrl}
          alt={book.title}
          loading="lazy"
          className="w-full h-full object-cover"
          onError={() => setErrored(true)}
        />
      </div>
    );
  }

  return (
    <div
      className={cn("relative shrink-0 rounded-[3px] book-shadow overflow-hidden flex flex-col justify-between p-2", sizes[size], className)}
      style={{ background: bg, color: accent }}
    >
      <div className="font-serif font-semibold leading-tight" style={{ fontSize: "0.85em" }}>
        {book.title}
      </div>
      <div className="flex justify-center items-center flex-1 opacity-25">
        <svg viewBox="0 0 40 40" className="w-1/2 h-1/2"><path fill="currentColor" d="M20 4l5 12h13l-10.5 8 4 12L20 28l-11.5 8 4-12L2 16h13z" /></svg>
      </div>
      {book.author && (
        <div className="opacity-80 tracking-wide" style={{ fontSize: "0.65em" }}>
          {book.author}
        </div>
      )}
    </div>
  );
}
