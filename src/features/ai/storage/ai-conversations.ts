import { getDB } from "../../../storage/db.ts";
import type { AIConversation } from "../types/ai.ts";

export async function saveConversation(conversation: AIConversation): Promise<void> {
  const db = await getDB();
  await db.put("aiConversations", conversation);
}

/** Every saved thread, most recently updated first. */
export async function listConversations(): Promise<AIConversation[]> {
  const db = await getDB();
  const all = (await db.getAllFromIndex("aiConversations", "by-updatedAt")) as AIConversation[];
  return all.reverse();
}

export async function deleteConversation(id: string): Promise<void> {
  const db = await getDB();
  await db.delete("aiConversations", id);
}

export async function getConversationsByEntry(entryId: string): Promise<AIConversation[]> {
  const db = await getDB();
  return db.getAllFromIndex("aiConversations", "by-entryId", entryId);
}
