import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import {
  searchBooksServer,
  lookupByIsbnServer,
  enrichBookDetailsServer,
} from "@/lib/book-search.server";
import type { BookSearchResult } from "@/lib/book-search-types";
import { filterBySource, paginate, parseSearchParams } from "@/lib/book-search-params";

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

// M15: lock the wire format. No .passthrough() — hostile clients used to
// inject arbitrary keys that flowed through to the rendered items. Use
// `.strict()` (at both levels) so unknown keys are rejected, not silently
// stripped (default) or echoed (passthrough).
const enrichSchema = z
  .object({
    result: z
      .object({
        source: z.enum(["openlibrary", "google", "bn"]),
        external_id: z.string(),
        title: z.string(),
        author: z.string(),
        isbn: z.string().optional(),
      })
      .strict(),
  })
  .strict();

// Batch ISBN lookups live in the sibling route at
// `src/routes/api/book-search.batch.ts` (TanStack Start matches exact
// paths under `/api/*`, so a `/batch` suffix needs its own file).

export const Route = createFileRoute("/api/book-search")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const parsed = parseSearchParams(url.searchParams);
        if (!parsed.ok) {
          return json({ error: parsed.error }, { status: 400 });
        }
        const { q, isbn, page, pageSize, sources } = parsed.params;

        if (isbn) {
          const result = await lookupByIsbnServer(isbn);
          if (!result) return json({ page: 1, pageSize, total: 0, items: [], hasMore: false });
          const items = filterBySource(result ? [result] : [], sources);
          return json({
            page: 1,
            pageSize,
            total: items.length,
            items,
            hasMore: false,
          });
        }

        const all = await searchBooksServer(q!);
        const filtered = filterBySource(all, sources);
        const page1 = paginate(filtered, page, pageSize);
        return json(page1);
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
