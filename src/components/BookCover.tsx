import type { Book } from "@/lib/mock-data";
import { cn } from "@/lib/utils";

interface Props { book: Book; className?: string; size?: "sm" | "md" | "lg" | "xl"; }

const sizes = {
  sm: "w-16 h-24 text-[8px]",
  md: "w-24 h-36 text-[10px]",
  lg: "w-36 h-52 text-xs",
  xl: "w-48 h-72 text-sm",
};

export function BookCover({ book, className, size = "md" }: Props) {
  return (
    <div
      className={cn("relative shrink-0 rounded-sm book-shadow overflow-hidden flex flex-col justify-between p-2", sizes[size], className)}
      style={{ background: book.coverGradient, color: book.coverAccent }}
    >
      <div className="font-serif font-bold leading-tight uppercase tracking-wide" style={{ fontSize: "0.7em" }}>
        {book.title}
      </div>
      <div className="flex justify-center items-center flex-1 opacity-30">
        <svg viewBox="0 0 40 40" className="w-2/3 h-2/3"><path fill="currentColor" d="M20 4l5 12h13l-10.5 8 4 12L20 28l-11.5 8 4-12L2 16h13z"/></svg>
      </div>
      <div className="text-center opacity-80 uppercase tracking-widest" style={{ fontSize: "0.55em" }}>
        {book.author}
      </div>
    </div>
  );
}
