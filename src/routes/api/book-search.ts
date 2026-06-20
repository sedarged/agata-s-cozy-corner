import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import {
  searchBooksServer,
  lookupByIsbnServer,
  enrichBookDetailsServer,
} from "@/lib/book-search.server";
import type { BookSearchResult } from "@/lib/book-search-types";

function json(data: unknown, init?: ResponseInit): Response {
  return new Response(JSON.stringify(data), {
    ...init,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "public, max-age=300",
      ...(init?.headers ?? {}),
    },
  });
}

// Minimal validation — keep all fields (passthrough) and cast to BookSearchResult.
const enrichSchema = z.object({
  result: z
    .object({
      source: z.enum(["openlibrary", "google", "bn"]),
      external_id: z.string(),
      title: z.string(),
      author: z.string(),
      isbn: z.string().optional(),
    })
    .passthrough(),
});

export const Route = createFileRoute("/api/book-search")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const isbn = url.searchParams.get("isbn");
        const q = url.searchParams.get("q");
        if (isbn) {
          const result = await lookupByIsbnServer(isbn);
          return json(result);
        }
        if (q && q.trim()) {
          const results = await searchBooksServer(q.trim());
          return json(results);
        }
        return json({ error: "Provide a 'q' or 'isbn' query parameter." }, { status: 400 });
      },
      POST: async ({ request }) => {
        let body: unknown;
        try {
          body = await request.json();
        } catch {
          return json({ error: "Invalid JSON body." }, { status: 400 });
        }
        const parsed = enrichSchema.safeParse(body);
        if (!parsed.success) return json({ error: "Invalid book payload." }, { status: 400 });
        const enriched = await enrichBookDetailsServer(parsed.data.result as BookSearchResult);
        return json(enriched);
      },
    },
  },
});
