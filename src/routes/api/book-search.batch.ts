import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { lookupByIsbnServer } from "@/lib/book-search.server";
import { BATCH_MAX, splitIsbns } from "@/lib/book-search-batch";
import { mapWithConcurrency } from "@/lib/map-with-concurrency";

// Per-batch concurrency cap. Bounded to keep the worst-case fan-out at
// BATCH_CONCURRENCY × 3 upstream sources (OL/GB/BN) per request, rather
// than BATCH_MAX × 3 with an unconstrained Promise.allSettled. At 4
// concurrent lookups, 60 upstream calls in a single batch becomes 12.
const BATCH_CONCURRENCY = 4;

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

// Sibling route — TanStack Start matches exact paths under /api/*, so
// /api/book-search/batch needs its own `createFileRoute` registration
// here, not a dispatch hack inside the parent's POST handler.
const schema = z.object({
  isbns: z.array(z.string()).max(BATCH_MAX),
});

export const Route = createFileRoute("/api/book-search/batch")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        let body: unknown;
        try {
          body = await request.json();
        } catch {
          return json({ error: "Invalid JSON body." }, { status: 400 });
        }
        const parsed = schema.safeParse(body);
        if (!parsed.success) {
          return json(
            { error: "Invalid batch payload.", details: parsed.error.flatten() },
            { status: 400 },
          );
        }
        const split = splitIsbns(parsed.data.isbns);
        if (split.tooMany) {
          return json(
            { error: `Too many ISBNs; chunk to ${BATCH_MAX} per request.` },
            { status: 413 },
          );
        }
        // Per-ISBN lookup with a bounded concurrency cap. Each lookup
        // already fans out to OL/GB/BN inside lookupByIsbnServer, so the
        // unconstrained `Promise.allSettled` here would amplify a 20-ISBN
        // request into 20×3 = 60 parallel upstream HTTP calls. With
        // BATCH_CONCURRENCY=4, the worst case is 4×3 = 12. Per-ISBN
        // results are cached for 5 min so overlap is free within the TTL.
        // Per-item rejections become `{ ok: false, result: null }` so a
        // single upstream blip doesn't poison the whole batch.
        const items = await mapWithConcurrency(BATCH_CONCURRENCY, split.valid, async (isbn) => {
          try {
            const result = await lookupByIsbnServer(isbn);
            return { isbn, ok: true, result };
          } catch {
            return { isbn, ok: false, result: null };
          }
        });
        return json({ items, invalid: split.invalid });
      },
    },
  },
});
