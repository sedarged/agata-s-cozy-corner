import { useRef, useState } from "react";
import { Trash2, MessageSquare, Plus, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useFocusTrap } from "@/lib/use-focus-trap";
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
//   - Per-row delete via a custom `useFocusTrap`-driven confirm modal
//     (matches NoteEditor's `ConfirmModal` pattern). The trash button sets
//     `confirmDeleteId`; only one confirm is open at a time. No try/catch
//     around `remove.mutate` — the React Query hook's default `onError`
//     surfaces a toast (project L2).
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
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

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

  const pendingDelete = confirmDeleteId
    ? (chats.find((c) => c.id === confirmDeleteId) ?? null)
    : null;

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
                  className="p-1 rounded text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  aria-label="Zmień nazwę"
                >
                  <Pencil className="w-3.5 h-3.5" />
                </button>
              )}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setConfirmDeleteId(c.id);
                }}
                className="p-1 rounded text-muted-foreground hover:text-destructive focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                aria-label="Usuń rozmowę"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </li>
          );
        })}
        {chats.length === 0 && !chatsQuery.isPending && (
          <li className="text-xs text-muted-foreground p-2">
            Brak rozmów. Kliknij „Nowa rozmowa", żeby zacząć.
          </li>
        )}
      </ul>

      {pendingDelete && (
        <ConfirmModal
          title="Usunąć rozmowę?"
          body="Tej operacji nie da się cofnąć. Wszystkie wiadomości w tej rozmowie zostaną usunięte."
          confirmLabel="Usuń"
          cancelLabel="Anuluj"
          onConfirm={() => {
            remove.mutate({ chatId: pendingDelete.id });
            setConfirmDeleteId(null);
          }}
          onCancel={() => setConfirmDeleteId(null)}
        />
      )}
    </aside>
  );
}

function ConfirmModal({
  title,
  body,
  confirmLabel,
  cancelLabel,
  onConfirm,
  onCancel,
}: {
  title: string;
  body: string;
  confirmLabel: string;
  cancelLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useFocusTrap(ref, onCancel, true);
  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="chat-delete-confirm-title"
      onClick={onCancel}
    >
      <div
        ref={ref}
        className="glass rounded-2xl p-6 max-w-sm w-full"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 id="chat-delete-confirm-title" className="font-serif text-lg mb-2">
          {title}
        </h3>
        <p className="text-sm text-warm-muted mb-5">{body}</p>
        <div className="flex gap-2 justify-end">
          <button
            onClick={onCancel}
            className="px-4 py-2 rounded-full bg-[var(--glass-inner)] text-warm text-sm"
          >
            {cancelLabel}
          </button>
          <button
            onClick={onConfirm}
            className="px-4 py-2 rounded-full bg-[var(--accent-gold)] text-[var(--bg)] text-sm font-medium"
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
