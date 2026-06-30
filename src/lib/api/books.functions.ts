// Agata — server functions for the `books` resource. Zod-validated.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import * as booksRepo from "@/lib/db/repositories/books";
import { BookInputSchema, BookPatchSchema } from "@/lib/api/schemas";
import { enrichBookAsync } from "@/lib/wikidata-enrichment.server";

export const listBooks = createServerFn({ method: "POST" }).handler(async () => {
  return booksRepo.listBooks();
});

export const getBook = createServerFn({ method: "POST" })
  .validator(z.object({ id: z.string() }))
  .handler(async ({ data }) => booksRepo.getBook(data.id));

export const upsertBook = createServerFn({ method: "POST" })
  .validator(BookInputSchema)
  .handler(async ({ data }) => {
    const result = await booksRepo.upsertBook(data);
    // Fire-and-forget Wikidata enrichment. `void` discards the promise so
    // the create call returns immediately — enrichment happens on a
    // detached microtask. enrichBookAsync swallows all errors internally.
    void enrichBookAsync(result.id, {
      title: result.title,
      author: result.author,
      isbn: result.isbn,
    });
    return result;
  });

export const patchBook = createServerFn({ method: "POST" })
  .validator(BookPatchSchema)
  .handler(async ({ data }) => {
    const { id, ...patch } = data;
    const before = await booksRepo.getBook(id);
    const result = await booksRepo.patchBook(id, patch);
    // patchBook returns undefined when the row vanished between getBook
    // and the update — a race with delete. Bail out before dereferencing.
    if (!result) return undefined;
    // Only re-enrich when title or author actually changed AND we haven't
    // already enriched. Both gates skip the network round-trip on the hot
    // path of routine patches (currentPage++, status flip, rating, etc.).
    if (
      before &&
      !result.wikidataId &&
      (before.title !== result.title || before.author !== result.author)
    ) {
      void enrichBookAsync(result.id, {
        title: result.title,
        author: result.author,
        isbn: result.isbn,
      });
    }
    return result;
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

/**
 * Pin a manual cover for a book. The data URL is a base64-encoded
 * `data:image/...` produced by the in-browser `compressCoverFile` helper.
 * Sized to 2 MB to match the repo's validation; payloads over that
 * cap were rejected upstream in `compressCoverFile` already.
 */
export const setManualCover = createServerFn({ method: "POST" })
  .validator(
    z.object({ id: z.string().min(1).max(128), dataUrl: z.string().min(1).max(2_000_000) }),
  )
  .handler(async ({ data }) => booksRepo.setManualCover(data.id, data.dataUrl));

/**
 * Drop the manual cover override. The next render falls back to the
 * API-derived `coverUrl` (or the gradient placeholder if that's empty).
 */
export const clearManualCover = createServerFn({ method: "POST" })
  .validator(z.object({ id: z.string().min(1).max(128) }))
  .handler(async ({ data }) => booksRepo.clearManualCover(data.id));
