// Agata — server functions for the `books` resource. Zod-validated.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import * as booksRepo from "@/lib/db/repositories/books";
import { BookInputSchema, BookPatchSchema } from "@/lib/api/schemas";

export const listBooks = createServerFn({ method: "POST" }).handler(async () => {
  return booksRepo.listBooks();
});

export const getBook = createServerFn({ method: "POST" })
  .validator(z.object({ id: z.string() }))
  .handler(async ({ data }) => booksRepo.getBook(data.id));

export const upsertBook = createServerFn({ method: "POST" })
  .validator(BookInputSchema)
  .handler(async ({ data }) => booksRepo.upsertBook(data));

export const patchBook = createServerFn({ method: "POST" })
  .validator(BookPatchSchema)
  .handler(async ({ data }) => {
    const { id, ...patch } = data;
    return booksRepo.patchBook(id, patch);
  });

export const deleteBook = createServerFn({ method: "POST" })
  .validator(z.object({ id: z.string() }))
  .handler(async ({ data }) => booksRepo.deleteBook(data.id));

export const bumpCurrentPage = createServerFn({ method: "POST" })
  .validator(z.object({ id: z.string(), currentPage: z.number().int().nonnegative() }))
  .handler(async ({ data }) => booksRepo.bumpCurrentPage(data.id, data.currentPage));

export const searchBooks = createServerFn({ method: "POST" })
  .validator(z.object({ q: z.string().min(1) }))
  .handler(async ({ data }) => booksRepo.searchBooks(data.q));
