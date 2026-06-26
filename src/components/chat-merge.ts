// chat-merge.ts — pure helper that merges server-persisted messages
// into the local ChatPanel view-model.
//
// Why this exists (B1 regression, 2026-06-26):
//   ChatPanel renders an optimistic user + assistant bubble locally
//   (ids `u-{uuid}` / `a-{uuid}`) while the streaming fetch is in
//   flight. When the stream completes, /api/chat has already persisted
//   the assistant row server-side (and `useChatQuery` refetch returns
//   it). A naive id-based merge appends the persisted row on top of the
//   local bubble because the optimistic and server-side ids never
//   collide → 2x duplicates visible in the UI.
//
// The fix: dedupe by (role, content). The local optimistic bubble and
// the server-persisted row describe the same conversation turn iff they
// have the same role and the same content text. WELCOME is special
// (synthetic id) and is preserved via the explicit `welcome`-id check
// in the empty-persisted branch (see ChatPanel.tsx).

export interface ChatMsg {
  id: string;
  role: "user" | "assistant";
  content: string;
}

/**
 * Merge server-persisted messages into the local view-model.
 *
 * Rules:
 *  1. Every local message stays (optimistic bubbles, in-flight streaming
 *     text, the synthetic WELCOME).
 *  2. A persisted message is appended only if no local message has the
 *     same (role, content) pair. The role+content check is the only
 *     stable identity we have between optimistic and persisted.
 *  3. Order is preserved: local messages first (in their original order),
 *     then any new persisted messages in their server order.
 *
 * Edge cases:
 *  - Empty `persisted` → returns `local` unchanged.
 *  - WELCOME is a local-only synthetic message; it should NEVER appear
 *    in `persisted`. If a server row ever had `id === "welcome"`, we
 *    treat it as the local WELCOME and skip it.
 *
 * Pinned by chat-merge.spec.ts.
 */
export function mergeMessages<T extends ChatMsg>(local: T[], persisted: ChatMsg[]): T[] {
  if (persisted.length === 0) return local;
  const out: T[] = [...local];
  for (const p of persisted) {
    // Defensive: skip any persisted row whose id collides with the
    // synthetic WELCOME marker — that row is the server's copy of a
    // WELCOME we never actually sent, so don't double-render it.
    if (p.id === "welcome") continue;
    const dup = out.some((m) => m.role === p.role && m.content === p.content);
    if (!dup) out.push({ ...p } as T);
  }
  return out;
}
