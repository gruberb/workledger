import { getDB } from "./db.ts";
import type { AIConversation } from "../types/ai.ts";

export async function saveConversation(conversation: AIConversation): Promise<void> {
  const db = await getDB();
  await db.put("aiConversations", conversation);
}

export async function getConversation(id: string): Promise<AIConversation | undefined> {
  const db = await getDB();
  return db.get("aiConversations", id);
}

export async function getConversationsByEntry(entryId: string): Promise<AIConversation[]> {
  const db = await getDB();
  return db.getAllFromIndex("aiConversations", "by-entryId", entryId);
}

export async function deleteConversation(id: string): Promise<void> {
  const db = await getDB();
  await db.delete("aiConversations", id);
}

export async function clearAllConversations(): Promise<void> {
  const db = await getDB();
  await db.clear("aiConversations");
}
