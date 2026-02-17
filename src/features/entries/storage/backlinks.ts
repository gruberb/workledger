import { getDB } from "../../../storage/db.ts";
import type { PartialBlock } from "@blocknote/core";

const SETTINGS_KEY = "backlinksIndex";

interface BacklinksIndex {
  /** Map of targetEntryId → set of sourceEntryIds that link to it */
  [targetEntryId: string]: string[];
}

/** Extract all entryLink target IDs from a block tree */
export function extractEntryLinks(blocks: PartialBlock[]): string[] {
  const ids = new Set<string>();

  function walk(items: PartialBlock[]) {
    for (const block of items) {
      // Check inline content for entryLink
      if (Array.isArray(block.content)) {
        for (const inline of block.content) {
          const item = inline as Record<string, unknown>;
          if (item.type === "entryLink") {
            const props = item.props as Record<string, unknown> | undefined;
            const entryId = props?.entryId;
            if (typeof entryId === "string" && entryId) {
              ids.add(entryId);
            }
          }
        }
      }
      // Recurse into children
      if (Array.isArray(block.children)) {
        walk(block.children);
      }
    }
  }

  walk(blocks);
  return [...ids];
}

async function loadIndex(): Promise<BacklinksIndex> {
  const db = await getDB();
  const row = await db.get("settings", SETTINGS_KEY);
  if (!row) return {};
  try {
    return JSON.parse(row.value) as BacklinksIndex;
  } catch {
    return {};
  }
}

async function saveIndex(index: BacklinksIndex): Promise<void> {
  const db = await getDB();
  await db.put("settings", { key: SETTINGS_KEY, value: JSON.stringify(index) });
}

/** Update backlinks index after an entry is saved */
export async function updateBacklinks(sourceEntryId: string, blocks: PartialBlock[]): Promise<void> {
  const index = await loadIndex();
  const newTargets = extractEntryLinks(blocks);

  // Remove this source from all previous targets
  for (const targetId of Object.keys(index)) {
    index[targetId] = index[targetId].filter((id) => id !== sourceEntryId);
    if (index[targetId].length === 0) delete index[targetId];
  }

  // Add this source to new targets
  for (const targetId of newTargets) {
    if (targetId === sourceEntryId) continue; // skip self-links
    if (!index[targetId]) index[targetId] = [];
    if (!index[targetId].includes(sourceEntryId)) {
      index[targetId].push(sourceEntryId);
    }
  }

  await saveIndex(index);
}

/** Remove an entry from the backlinks index (when deleted) */
export async function removeFromBacklinks(entryId: string): Promise<void> {
  const index = await loadIndex();

  // Remove as target
  delete index[entryId];

  // Remove as source from all targets
  for (const targetId of Object.keys(index)) {
    index[targetId] = index[targetId].filter((id) => id !== entryId);
    if (index[targetId].length === 0) delete index[targetId];
  }

  await saveIndex(index);
}

/** Get all entries that link TO this entry */
export async function getBacklinks(entryId: string): Promise<string[]> {
  const index = await loadIndex();
  return index[entryId] ?? [];
}
