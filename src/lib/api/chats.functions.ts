// Agata — server functions for Gigi chat persistence. Zod-validated.
//
// These RPCs back the `useChatsQuery` / `useChatDetailQuery` /
// `useCreateChatMutation` / `useAppendMessageMutation` /
// `useRenameChatMutation` / `useDeleteChatMutation` React Query hooks in
// `client.ts` and are also reachable from any future curl-based migration
// tooling. They follow the project convention: namespace-import the repo,
// POST everything (the brief's `method: "GET"` was a deviation), pass
// `data` straight through (the repo calls `getDb()` itself), and reuse
// `DeleteChatInputSchema` for the single-id delete validator rather than
// redefining `IdSchema`.
import { createServerFn } from "@tanstack/react-start";
import * as chatsRepo from "@/lib/db/repositories/chats";
import {
  ChatSessionDetailSchema,
  ChatSessionSummarySchema,
  CreateChatInputSchema,
  AppendMessageInputSchema,
  RenameChatInputSchema,
  DeleteChatInputSchema,
} from "@/lib/api/schemas";

export const listChats = createServerFn({ method: "POST" }).handler(async () => {
  return ChatSessionSummarySchema.array().parse(await chatsRepo.listChats());
});

export const getChat = createServerFn({ method: "POST" })
  .validator(DeleteChatInputSchema)
  .handler(async ({ data }) => {
    const detail = await chatsRepo.getChat(data.chatId);
    if (!detail) throw new Error("Chat not found");
    return ChatSessionDetailSchema.parse(detail);
  });

export const createChat = createServerFn({ method: "POST" })
  .validator(CreateChatInputSchema)
  .handler(async ({ data }) => {
    return ChatSessionSummarySchema.parse(await chatsRepo.createChat(data));
  });

export const appendMessage = createServerFn({ method: "POST" })
  .validator(AppendMessageInputSchema)
  .handler(async ({ data }) => {
    return chatsRepo.appendMessage({
      id: crypto.randomUUID(),
      chatId: data.chatId,
      role: data.role,
      content: data.content,
    });
  });

export const renameChat = createServerFn({ method: "POST" })
  .validator(RenameChatInputSchema)
  .handler(async ({ data }) => {
    return ChatSessionSummarySchema.parse(await chatsRepo.renameChat(data.chatId, data.title));
  });

export const deleteChat = createServerFn({ method: "POST" })
  .validator(DeleteChatInputSchema)
  .handler(async ({ data }) => {
    await chatsRepo.deleteChat(data.chatId);
    return { ok: true as const };
  });
