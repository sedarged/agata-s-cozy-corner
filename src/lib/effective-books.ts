import { useMemo } from "react";
import type { Book, BookStatus } from "./mock-data";
import {
  getAllBooks,
  getEffectiveBookById as getBaseEffectiveBookById,
  useBooksVersion,
} from "./books-store";
import { getAllBookState, useWorkspaceVersion } from "./book-workspace-store";

export type EffectiveBook = Book & {
  publisher?: string;
  language?: string;
  seriesName?: string;
  seriesPart?: string;
  source?: string;
  addedAt?: string;
  updatedAt?: string;
  opinion?: string;
  startedAt?: string;
  finishedAt?: string;
};

const VALID_STATUSES = new Set<BookStatus>(["reading", "queue", "finished", "paused", "dropped"]);

function mergeWorkspaceState(book: Book): EffectiveBook {
  const state = getAllBookState()[book.id];
  if (!state) return book as EffectiveBook;

  const status = VALID_STATUSES.has(state.status as BookStatus)
    ? (state.status as BookStatus)
    : book.status;

  return {
    ...(book as EffectiveBook),
    status,
    currentPage: state.currentPage ?? book.currentPage ?? 0,
    rating: state.rating ?? book.rating,
    isFavourite: state.favourite ?? book.isFavourite,
    opinion: state.opinion ?? (book as EffectiveBook).opinion,
    startedAt: state.startedAt ?? (book as EffectiveBook).startedAt,
    finishedAt: state.finishedAt ?? (book as EffectiveBook).finishedAt,
  };
}

export function getAllEffectiveBooks(): EffectiveBook[] {
  return getAllBooks().map(mergeWorkspaceState);
}

export function getEffectiveBookByIdSafe(bookId: string): EffectiveBook | undefined {
  const book = getBaseEffectiveBookById(bookId);
  return book ? mergeWorkspaceState(book) : undefined;
}

export function useEffectiveBooksVersion(): string {
  const booksVersion = useBooksVersion();
  const workspaceVersion = useWorkspaceVersion();
  return `${booksVersion}:${workspaceVersion}`;
}

export function useAllEffectiveBooks(): EffectiveBook[] {
  const version = useEffectiveBooksVersion();
  return useMemo(() => getAllEffectiveBooks(), [version]);
}

export function useEffectiveBook(bookId: string): EffectiveBook | undefined {
  const version = useEffectiveBooksVersion();
  return useMemo(() => getEffectiveBookByIdSafe(bookId), [bookId, version]);
}
