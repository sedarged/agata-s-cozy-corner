import { useState } from "react";
import { Trash2, MessageSquare, Plus, Pencil } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  useChatsQuery,
  useCreateChatMutation,
  useDeleteChatMutation,
  useRenameChatMutation,
} from "@/lib/api/client";

// ChatSidebar — vertical conversation list for the Gigi chat page.
// Pulled out of `/gigi` so the route can swap conversations via
// `onSelect(id)` without re-mounting the composer (ChatPanel).
//
// Responsibilities:
//   - List persisted chats (`useChatsQuery`, sorted updatedAt desc by the server).
//   - Provide a "+ Nowa rozmowa" CTA that mints a client-side id, runs
//     `useCreateChatMutation`, and bubbles the new id up via `onNewChat`.
//   - Per-row rename via inline `<input>` (blur or Enter commits, Escape cancels).
//   - Per-row delete via Radix AlertDialog confirm — no try/catch needed;
//     the hook already surfaces errors via toast.
//   - Highlight the active chat via `bg-muted`.
//
// What it does NOT do (deferred to Task 9):
//   - URL deep-link (`/gigi/c-<id>`) and `useRouter` sync.
//   - Active-chat state management — that's the parent's job.

interface ChatSidebarProps {
  activeChatId: string | null;
  onSelect?: (chatId: string) => void;
  onNewChat?: (chatId: string) => void;
}

export function ChatSidebar({ activeChatId, onSelect, onNewChat }: ChatSidebarProps) {
  const handleSelect = (chatId: string) => onSelect?.(chatId);
  const handleNew = (chatId: string) => onNewChat?.(chatId);
  const chatsQuery = useChatsQuery();
  const create = useCreateChatMutation();
  const remove = useDeleteChatMutation();
  const rename = useRenameChatMutation();
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [draftTitle, setDraftTitle] = useState("");

  const chats = chatsQuery.data ?? [];

  function onCreate() {
    const id = `c-${crypto.randomUUID()}`;
    create.mutate(
      { id },
      {
        onSuccess: (s) => handleNew(s.id),
      },
    );
  }

  return (
    <aside className="w-full sm:w-72 border-r border-border bg-card/30 flex flex-col gap-2 p-3">
      <Button onClick={onCreate} disabled={create.isPending} className="w-full justify-start gap-2">
        <Plus className="w-4 h-4" />
        {create.isPending ? "Tworzę…" : "Nowa rozmowa"}
      </Button>

      <ul className="flex-1 overflow-y-auto space-y-1">
        {chats.map((c) => {
          const active = c.id === activeChatId;
          const isRenaming = renamingId === c.id;
          return (
            <li
              key={c.id}
              data-testid={`chat-row-${c.id}`}
              className={
                "rounded-lg p-2 flex items-center gap-2 cursor-pointer hover:bg-muted/50 " +
                (active ? "bg-muted" : "")
              }
              onClick={() => !isRenaming && handleSelect(c.id)}
            >
              <MessageSquare className="w-4 h-4 shrink-0 text-muted-foreground" />
              {isRenaming ? (
                <input
                  autoFocus
                  value={draftTitle}
                  onChange={(e) => setDraftTitle(e.target.value)}
                  onBlur={() => {
                    if (draftTitle.trim()) {
                      rename.mutate({ chatId: c.id, title: draftTitle.trim() });
                    }
                    setRenamingId(null);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") (e.target as HTMLInputElement).blur();
                    if (e.key === "Escape") setRenamingId(null);
                  }}
                  className="flex-1 bg-transparent outline-none text-sm"
                />
              ) : (
                <span className="flex-1 truncate text-sm" title={c.title ?? ""}>
                  {c.title ?? "Nowa rozmowa"}
                </span>
              )}
              {!isRenaming && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setDraftTitle(c.title ?? "");
                    setRenamingId(c.id);
                  }}
                  className="p-1 text-muted-foreground hover:text-foreground"
                  aria-label="Zmień nazwę"
                >
                  <Pencil className="w-3.5 h-3.5" />
                </button>
              )}
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <button
                    onClick={(e) => e.stopPropagation()}
                    className="p-1 text-muted-foreground hover:text-destructive"
                    aria-label="Usuń rozmowę"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Usunąć rozmowę?</AlertDialogTitle>
                    <AlertDialogDescription>
                      Tej operacji nie da się cofnąć. Wszystkie wiadomości w tej rozmowie zostaną
                      usunięte.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Anuluj</AlertDialogCancel>
                    <AlertDialogAction onClick={() => remove.mutate({ chatId: c.id })}>
                      Usuń
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </li>
          );
        })}
        {chats.length === 0 && !chatsQuery.isPending && (
          <li className="text-xs text-muted-foreground p-2">
            Brak rozmów. Kliknij „Nowa rozmowa", żeby zacząć.
          </li>
        )}
      </ul>
    </aside>
  );
}
