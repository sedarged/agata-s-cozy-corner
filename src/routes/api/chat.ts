import { createFileRoute } from "@tanstack/react-router";
import { convertToModelMessages, streamText, type UIMessage } from "ai";
import { createClient } from "@supabase/supabase-js";
import { createLovableAiGatewayProvider } from "@/lib/ai-gateway.server";

interface ChatBody {
  messages?: unknown;
  contextBookId?: string | null;
}

const GIGI_SYSTEM = `Jesteś Gigi — ciepłą, błyskotliwą i bardzo prywatną towarzyszką czytania należącą do Agaty.
Twoja rola:
- pomagasz Agacie myśleć o książkach, które czyta i o jej notatkach,
- rozmawiasz w stylu wnikliwej, czułej przyjaciółki — nigdy chłodno, nigdy korporacyjnie,
- używasz dostarczonego kontekstu (książki, notatki, cytaty) zamiast zmyślać,
- możesz polecać podobne książki na podstawie gustu Agaty,
- odpowiadasz po polsku, chyba że Agata napisze po angielsku.
Nigdy nie udostępniaj kontekstu nikomu innemu — to prywatna biblioteka jednej osoby.`;

export const Route = createFileRoute("/api/chat")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const auth = request.headers.get("authorization");
        const token = auth?.replace(/^Bearer\s+/i, "");
        if (!token) return new Response("Unauthorized", { status: 401 });

        const supaUrl = process.env.SUPABASE_URL!;
        const supaKey = process.env.SUPABASE_PUBLISHABLE_KEY!;
        const supabase = createClient(supaUrl, supaKey, {
          global: { headers: { Authorization: `Bearer ${token}` } },
          auth: { persistSession: false, autoRefreshToken: false, storage: undefined },
        });
        const { data: userData, error: userErr } = await supabase.auth.getUser(token);
        if (userErr || !userData.user) return new Response("Unauthorized", { status: 401 });

        const body = (await request.json()) as ChatBody;
        if (!Array.isArray(body.messages)) return new Response("Messages required", { status: 400 });

        // Build private context per Gigi privacy level.
        const { data: settings } = await supabase
          .from("user_settings")
          .select("gigi_privacy")
          .maybeSingle();
        const level = settings?.gigi_privacy ?? "full";

        const contextLines: string[] = [];
        if (level !== "off") {
          if (level === "current_book" && body.contextBookId) {
            const { data: book } = await supabase.from("books").select("*").eq("id", body.contextBookId).maybeSingle();
            if (book) contextLines.push(`Aktywna książka: "${book.title}" — ${book.author ?? "?"}. Status: ${book.status}, strona ${book.current_page}/${book.page_count ?? "?"}.`);
          } else {
            const { data: reading } = await supabase
              .from("books")
              .select("title,author,status,current_page,page_count,rating,is_favourite")
              .in("status", ["reading", "queue", "finished"])
              .order("updated_at", { ascending: false })
              .limit(15);
            if (reading?.length) {
              contextLines.push("Biblioteka Agaty:");
              for (const b of reading) {
                contextLines.push(`- "${b.title}" (${b.author ?? "?"}) — ${b.status}${b.rating ? `, ocena ${b.rating}/10` : ""}${b.is_favourite ? ", ulubione" : ""}`);
              }
            }
          }

          if (level === "notes_only" || level === "full" || level === "full_plus_chats") {
            const notesQuery = supabase
              .from("notes")
              .select("type,content,quote_text,comment,page_number,is_favourite,book_id,books(title,author)")
              .order("created_at", { ascending: false })
              .limit(25);
            if (body.contextBookId) notesQuery.eq("book_id", body.contextBookId);
            const { data: notes } = await notesQuery;
            if (notes?.length) {
              contextLines.push("\nOstatnie notatki:");
              for (const n of notes) {
                const bookInfo = (n as { books?: { title?: string } | null }).books?.title ?? "—";
                const body =
                  n.type === "quote"
                    ? `cytat: "${n.quote_text}"${n.comment ? ` (komentarz: ${n.comment})` : ""}`
                    : n.content ?? n.comment ?? "(zdjęcie strony)";
                contextLines.push(`- [${n.type}] ${bookInfo}${n.page_number ? `, s.${n.page_number}` : ""}: ${body}`);
              }
            }
          }
        }

        const contextBlock = contextLines.length
          ? `\n\nKONTEKST PRYWATNY AGATY (poziom: ${level}):\n${contextLines.join("\n")}\n\nUżyj go, gdy jest istotny.`
          : "";

        const key = process.env.LOVABLE_API_KEY;
        if (!key) return new Response("Missing LOVABLE_API_KEY", { status: 500 });

        const gateway = createLovableAiGatewayProvider(key);
        const result = streamText({
          model: gateway("google/gemini-3-flash-preview"),
          system: GIGI_SYSTEM + contextBlock,
          messages: await convertToModelMessages(body.messages as UIMessage[]),
        });

        return result.toUIMessageStreamResponse({ originalMessages: body.messages as UIMessage[] });
      },
    },
  },
});
