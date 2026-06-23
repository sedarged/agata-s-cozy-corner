import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { lookupByIsbnServer } from "@/lib/book-search.server";
import { BATCH_MAX, splitIsbns } from "@/lib/book-search-batch";

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
        // Per-ISBN lookup in parallel. Each one is already cached by
        // lookupByIsbnServer, so overlapping ISBNs are free within the TTL.
        // Settled rejections are swallowed into a per-item `ok: false`
        // marker so a single upstream blip doesn't poison the whole batch.
        const settled = await Promise.allSettled(
          split.valid.map((isbn) => lookupByIsbnServer(isbn)),
        );
        const items = settled.map((r, i) => {
          if (r.status === "fulfilled") {
            return { isbn: split.valid[i], ok: true, result: r.value };
          }
          return { isbn: split.valid[i], ok: false, result: null };
        });
        return json({ items, invalid: split.invalid });
      },
    },
  },
});
