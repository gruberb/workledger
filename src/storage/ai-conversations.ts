import { getDB } from "./db.ts";
import type { AIConversation } from "../types/ai.ts";

export async function saveConversation(conversation: AIConversation): Promise<void> {
  const db = await getDB();
  await db.put("aiConversations", conversation);
}

export async function getConversationsByEntry(entryId: string): Promise<AIConversation[]> {
  const db = await getDB();
  return db.getAllFromIndex("aiConversations", "by-entryId", entryId);
}

export async function clearAllConversations(): Promise<void> {
  const db = await getDB();
  await db.clear("aiConversations");
}
