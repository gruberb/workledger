import type { Block } from "@blocknote/core";
import type { SearchIndexEntry } from "../types/entry.ts";
import { getDB } from "./db.ts";

function extractTextFromBlocks(blocks: Block[]): string {
  const parts: string[] = [];

  for (const block of blocks) {
    if (block.content && Array.isArray(block.content)) {
      for (const inline of block.content) {
        if (inline.type === "text") {
          parts.push(inline.text);
        }
      }
    }
    if (block.children && block.children.length > 0) {
      parts.push(extractTextFromBlocks(block.children));
    }
  }

  return parts.join(" ");
}

export async function updateSearchIndex(
  entryId: string,
  dayKey: string,
  blocks: Block[],
  tags: string[] = [],
): Promise<void> {
  const db = await getDB();
  const plainText = extractTextFromBlocks(blocks).toLowerCase();
  const entry: SearchIndexEntry = {
    entryId,
    dayKey,
    plainText,
    updatedAt: Date.now(),
    tags,
  };
  await db.put("searchIndex", entry);
}

export async function searchEntries(query: string): Promise<SearchIndexEntry[]> {
  if (!query.trim()) return [];
  const db = await getDB();
  const all = (await db.getAll("searchIndex")) as SearchIndexEntry[];
  const terms = query.toLowerCase().split(/\s+/);
  return all
    .filter((entry) => {
      const tagText = (entry.tags ?? []).join(" ").toLowerCase();
      const searchable = entry.plainText + " " + tagText;
      return terms.every((term) => searchable.includes(term));
    })
    .sort((a, b) => b.updatedAt - a.updatedAt);
}

export async function deleteSearchIndex(entryId: string): Promise<void> {
  const db = await getDB();
  await db.delete("searchIndex", entryId);
}
