// Agata — Gigi chat persistence repository. CRUD over chat_sessions +
// chat_messages. Append-on-message bumps the parent session.updatedAt so
// listChats() surfaces the most recently active chat first; ON DELETE CASCADE
// on chat_messages.chat_id cleans up messages when a session is removed.
//
// Book-linking (§5.8 of the brief): createChat and appendMessage both
// accept an optional `bookId`. When set on createChat, the session is
// permanently tagged with that book; subsequent appendMessage calls
// inherit it onto chat_messages so analytics queries ("all chats about
// this book") don't need a join. When the parent book is deleted, FK
// ON DELETE SET NULL clears the link without losing the conversation.
import "@tanstack/react-start/server-only";

import { and, asc, desc, eq } from "drizzle-orm";

import { getDb } from "../client";
import { chatMessages, chatSessions, type ChatMessage, type ChatSession } from "../schema";

const nowIso = () => new Date().toISOString();

export interface ChatDetail {
  session: ChatSession;
  messages: ChatMessage[];
}

export type ChatMessageRole = "user" | "assistant";

export async function listChats(): Promise<ChatSession[]> {
  return getDb()
    .select()
    .from(chatSessions)
    .orderBy(desc(chatSessions.updatedAt))
    .all() as ChatSession[];
}

/**
 * List chats tagged with a specific book id. Powers the "previous Gigi
 * chats about this book" surface on book detail. Same sort order as
 * listChats (most recently updated first).
 */
export async function listChatsForBook(bookId: string): Promise<ChatSession[]> {
  return getDb()
    .select()
    .from(chatSessions)
    .where(eq(chatSessions.bookId, bookId))
    .orderBy(desc(chatSessions.updatedAt))
    .all() as ChatSession[];
}

export async function getChat(id: string): Promise<ChatDetail | null> {
  const session = getDb().select().from(chatSessions).where(eq(chatSessions.id, id)).get() as
    | ChatSession
    | undefined;
  if (!session) return null;
  const messages = getDb()
    .select()
    .from(chatMessages)
    .where(eq(chatMessages.chatId, id))
    .orderBy(asc(chatMessages.createdAt))
    .all() as ChatMessage[];
  return { session, messages };
}

export interface CreateChatInput {
  id: string;
  title?: string | null;
  /**
   * Optional book link. When set, the chat session is permanently tagged
   * with this bookId so the conversation can be reopened from the book's
   * page later. Pre-existing chats (NULL bookId) keep working unchanged.
   */
  bookId?: string | null;
}

export async function createChat(input: CreateChatInput): Promise<ChatSession> {
  const now = nowIso();
  getDb()
    .insert(chatSessions)
    .values({
      id: input.id,
      title: input.title ?? null,
      bookId: input.bookId ?? null,
      createdAt: now,
      updatedAt: now,
    })
    .run();
  return (await getChat(input.id))!.session;
}

export interface AppendMessageInput {
  id: string;
  chatId: string;
  role: ChatMessageRole;
  content: string;
  /**
   * Optional bookId mirror on chat_messages. Callers should pass the
   * parent session's bookId (when set) so analytics queries can filter
   * by book without a join. When null/undefined, the message keeps the
   * session's book context — see the denormalised `bookId` column on
   * chat_messages. If the caller passes `null` explicitly and the parent
   * session has a bookId, the parent's bookId is still inherited (the
   * session is the source of truth).
   */
  bookId?: string | null;
}

export async function appendMessage(msg: AppendMessageInput): Promise<ChatMessage> {
  const now = nowIso();
  // Inherit bookId from the parent session if the caller didn't supply
  // one explicitly. Keeps the denormalised column consistent with the
  // session — the brief asks for "Chat should store linked bookId" and
  // analytics queries assume every message in a book-linked chat also
  // carries that bookId.
  const session = getDb()
    .select({ bookId: chatSessions.bookId })
    .from(chatSessions)
    .where(eq(chatSessions.id, msg.chatId))
    .get() as { bookId: string | null } | undefined;
  const inheritedBookId = session?.bookId ?? null;
  const effectiveBookId = msg.bookId !== undefined ? msg.bookId : inheritedBookId;

  getDb()
    .insert(chatMessages)
    .values({
      id: msg.id,
      chatId: msg.chatId,
      role: msg.role,
      content: msg.content,
      bookId: effectiveBookId,
      createdAt: now,
    })
    .run();
  // Touch the parent session so listChats() surfaces it at the top.
  getDb().update(chatSessions).set({ updatedAt: now }).where(eq(chatSessions.id, msg.chatId)).run();
  return getDb()
    .select()
    .from(chatMessages)
    .where(eq(chatMessages.id, msg.id))
    .get() as ChatMessage;
}

export async function deleteChat(id: string): Promise<void> {
  // ON DELETE CASCADE on chat_messages.chat_id cleans up child rows.
  getDb().delete(chatSessions).where(eq(chatSessions.id, id)).run();
}

export async function renameChat(id: string, title: string): Promise<ChatSession> {
  const now = nowIso();
  getDb().update(chatSessions).set({ title, updatedAt: now }).where(eq(chatSessions.id, id)).run();
  return getDb().select().from(chatSessions).where(eq(chatSessions.id, id)).get() as ChatSession;
}

export async function touchChat(id: string): Promise<void> {
  const now = nowIso();
  getDb().update(chatSessions).set({ updatedAt: now }).where(eq(chatSessions.id, id)).run();
}

// Re-export for tests that want to compose filters without re-importing
// drizzle operators from this module's internal surface.
export { and };
