// Agata — Gigi chat persistence repository. CRUD over chat_sessions +
// chat_messages. Append-on-message bumps the parent session.updatedAt so
// listChats() surfaces the most recently active chat first; ON DELETE CASCADE
// on chat_messages.chat_id cleans up messages when a session is removed.
import "@tanstack/react-start/server-only";

import { asc, desc, eq } from "drizzle-orm";

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
}

export async function createChat(input: CreateChatInput): Promise<ChatSession> {
  const now = nowIso();
  getDb()
    .insert(chatSessions)
    .values({
      id: input.id,
      title: input.title ?? null,
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
}

export async function appendMessage(msg: AppendMessageInput): Promise<ChatMessage> {
  const now = nowIso();
  getDb()
    .insert(chatMessages)
    .values({
      id: msg.id,
      chatId: msg.chatId,
      role: msg.role,
      content: msg.content,
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
