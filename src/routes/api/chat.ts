import { createFileRoute } from "@tanstack/react-router";
import { streamText } from "ai";
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { createLovableAiGatewayProvider } from "@/lib/ai-gateway.server";

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

  if (ctx.books?.length) {
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

function resolveModel() {
  const lovableKey = process.env.LOVABLE_API_KEY;
  const openaiKey = process.env.OPENAI_API_KEY;

  if (openaiKey) {
    const provider = createOpenAICompatible({
      name: "openai",
      baseURL: "https://api.openai.com/v1",
      headers: { Authorization: `Bearer ${openaiKey}` },
    });
    return provider("gpt-4o-mini");
  }

  if (lovableKey) {
    const gateway = createLovableAiGatewayProvider(lovableKey);
    return gateway("google/gemini-3-flash-preview");
  }

  return null;
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

        const model = resolveModel();
        if (!model) {
          return new Response(
            "Gigi nie jest jeszcze skonfigurowana. Ustaw OPENAI_API_KEY lub LOVABLE_API_KEY na serwerze.",
            { status: 503 },
          );
        }

        const body = (await request.json()) as ChatBody;
        if (!Array.isArray(body.messages) || !body.messages.every(isChatMessage)) {
          return new Response("Messages required", { status: 400 });
        }
        const messages = body.messages as ChatMessage[];
        const contextBlock = buildContextBlock(body.context);

        const result = streamText({
          model,
          system: GIGI_SYSTEM + contextBlock,
          messages,
        });

        return result.toTextStreamResponse();
      },
    },
  },
});
