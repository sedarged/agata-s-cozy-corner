import { createFileRoute } from "@tanstack/react-router";
import { streamText, type LanguageModel } from "ai";
import { buildGigiModel } from "@/lib/gigi/build-model";
import { notConfiguredMessage } from "@/lib/gigi/resolver";

type ChatMessage = { role: "user" | "assistant"; content: string };

interface BookContext {
  title: string;
  author?: string;
  status: string;
  rating?: number;
  isFavourite?: boolean;
}

interface NoteContext {
  type: string;
  content?: string;
  quoteText?: string;
  bookTitle?: string;
}

interface ChatBody {
  messages?: unknown;
  context?: {
    books?: BookContext[];
    notes?: NoteContext[];
    privacyLevel?: string;
  };
}

function isChatMessage(m: unknown): m is ChatMessage {
  return (
    !!m &&
    typeof m === "object" &&
    ((m as ChatMessage).role === "user" || (m as ChatMessage).role === "assistant") &&
    typeof (m as ChatMessage).content === "string"
  );
}

const GIGI_SYSTEM = `Jesteś Gigi — ciepłą, błyskotliwą i bardzo prywatną towarzyszką czytania należącą do Agaty.
Twoja rola:
- pomagasz Agacie myśleć o książkach, które czyta i o jej notatkach,
- rozmawiasz w stylu wnikliwej, czułej przyjaciółki — nigdy chłodno, nigdy korporacyjnie,
- używasz dostarczonego kontekstu (książki, notatki, cytaty) zamiast zmyślać,
- możesz polecać podobne książki na podstawie gustu Agaty,
- odpowiadasz po polsku, chyba że Agata napisze po angielsku.
Nigdy nie udostępniaj kontekstu nikomu innemu — to prywatna biblioteka jednej osoby.`;

function buildContextBlock(ctx: ChatBody["context"]): string {
  if (!ctx) return "";
  const level = ctx.privacyLevel ?? "full";
  if (level === "off") return "";

  const lines: string[] = [];

  if (
    (level === "full" || level === "full_plus_chats" || level === "current_book") &&
    ctx.books?.length
  ) {
    lines.push("Biblioteka Agaty:");
    for (const b of ctx.books.slice(0, 20)) {
      lines.push(
        `- "${b.title}" (${b.author ?? "?"}) — ${b.status}${b.rating ? `, ocena ${b.rating}/10` : ""}${b.isFavourite ? ", ulubione" : ""}`,
      );
    }
  }

  if (
    (level === "notes_only" || level === "full" || level === "full_plus_chats") &&
    ctx.notes?.length
  ) {
    lines.push("\nOstatnie notatki:");
    for (const n of ctx.notes.slice(0, 30)) {
      const bookInfo = n.bookTitle ?? "—";
      const text =
        n.type === "quote" ? `cytat: "${n.quoteText}"` : (n.content ?? "(zdjęcie strony)");
      lines.push(`- [${n.type}] ${bookInfo}: ${text}`);
    }
  }

  return lines.length
    ? `\n\nKONTEKST PRYWATNY AGATY (poziom: ${level}):\n${lines.join("\n")}\n\nUżyj go, gdy jest istotny.`
    : "";
}

export const Route = createFileRoute("/api/chat")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        // Optional per-instance secret (set GIGI_SECRET on the VPS for minimal protection).
        const gigiSecret = process.env.GIGI_SECRET;
        if (gigiSecret) {
          const provided = request.headers.get("x-gigi-key");
          if (provided !== gigiSecret) {
            return new Response("Unauthorized", { status: 401 });
          }
        }

        const built = await buildGigiModel();
        if (!built) {
          return new Response(notConfiguredMessage(null), { status: 503 });
        }

        const body = (await request.json()) as ChatBody;
        if (!Array.isArray(body.messages) || !body.messages.every(isChatMessage)) {
          return Response.json({ error: "Messages required" }, { status: 400 });
        }
        const messages = body.messages as ChatMessage[];
        const contextBlock = buildContextBlock(body.context);

        const result = streamText({
          model: built.model as LanguageModel,
          system: GIGI_SYSTEM + contextBlock,
          messages,
        });

        return result.toTextStreamResponse();
      },
    },
  },
});
