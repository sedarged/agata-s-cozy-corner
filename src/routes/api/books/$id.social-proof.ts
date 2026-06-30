// /api/books/:id/social-proof — returns reader ratings + highlights for a
// book from Hardcover (preferred) or the deterministic mock when no token
// is configured. Server-only because the Hardcover bearer token must not
// leak to the browser.
//
// Behaviour contract:
//   - 200 + BookSocialProofDTO when the book exists (even if Hardcover
//     returns nothing — the mock keeps the UI populated).
//   - 404 + { error: "not-found" } when the book is missing.
//   - 400 + { error: "invalid-id" } when the id fails the schema cap.
import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { apiJson } from "@/lib/api/error";
import * as booksRepo from "@/lib/db/repositories/books";
import { fetchHardcoverReviews } from "@/lib/social-proof.server";

const IdParam = z.string().min(1).max(128);

export const Route = createFileRoute("/api/books/$id/social-proof")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        const parsed = IdParam.safeParse(params.id);
        if (!parsed.success) {
          return apiJson({ error: "invalid-id" }, { status: 400 });
        }
        const id = parsed.data;
        const book = await booksRepo.getBook(id);
        if (!book) {
          return apiJson({ error: "not-found" }, { status: 404 });
        }
        const proof = await fetchHardcoverReviews({
          bookId: book.id,
          isbn: book.isbn || undefined,
          title: book.title,
          author: book.author || undefined,
        });
        return apiJson(proof);
      },
    },
  },
});
