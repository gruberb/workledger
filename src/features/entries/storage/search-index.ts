import type { Block } from "@blocknote/core";
import type { SearchIndexEntry, WorkLedgerEntry } from "../types/entry.ts";
import { getDB } from "../../../storage/db.ts";
import { extractTitle } from "../utils/extract-title.ts";

export function extractTextFromBlocks(blocks: Block[]): string {
  const parts: string[] = [];

  for (const block of blocks) {
    if (block.content && Array.isArray(block.content)) {
      for (const inline of block.content) {
        if (inline.type === "text") {
          parts.push(inline.text);
        } else {
          // Handle custom inline content (e.g. entryLink)
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const ic = inline as any;
          if (ic.type === "entryLink" && ic.props?.displayText) {
            parts.push(ic.props.displayText);
          }
        }
      }
    }
    if (block.children && block.children.length > 0) {
      parts.push(extractTextFromBlocks(block.children));
    }
  }

  return parts.join(" ");
}

export function toSearchRow(entry: WorkLedgerEntry): SearchIndexEntry {
  return {
    entryId: entry.id,
    dayKey: entry.dayKey,
    plainText: extractTextFromBlocks(entry.blocks as Block[]).toLowerCase(),
    // Lets the wiki-link menu list titles without reading every entry.
    title: extractTitle(entry),
    createdAt: entry.createdAt,
    // The entry's own timestamp, so re-indexing (import, unarchive) does not
    // reorder "recent" wiki-link suggestions.
    updatedAt: entry.updatedAt,
    tags: entry.tags ?? [],
  };
}

/** Keeps the search row in line with the entry: archived entries are not searchable. */
export async function reindexEntry(entry: WorkLedgerEntry): Promise<void> {
  const db = await getDB();
  if (entry.isArchived) {
    await db.delete("searchIndex", entry.id);
  } else {
    await db.put("searchIndex", toSearchRow(entry));
  }
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

export async function getRecentSearchEntries(
  limit = 10,
): Promise<SearchIndexEntry[]> {
  const db = await getDB();
  const all = (await db.getAll("searchIndex")) as SearchIndexEntry[];
  return all.sort((a, b) => b.updatedAt - a.updatedAt).slice(0, limit);
}

/** One search row, a small read compared with the whole entry. */
export async function getSearchRow(entryId: string): Promise<SearchIndexEntry | undefined> {
  const db = await getDB();
  return (await db.get("searchIndex", entryId)) as SearchIndexEntry | undefined;
}

export async function deleteSearchIndex(entryId: string): Promise<void> {
  const db = await getDB();
  await db.delete("searchIndex", entryId);
}
