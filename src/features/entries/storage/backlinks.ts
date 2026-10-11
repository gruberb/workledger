import { getDB, registerDerivedSetting } from "../../../storage/db.ts";
import type { PartialBlock } from "@blocknote/core";

const SETTINGS_KEY = "backlinksIndex";

interface BacklinksIndex {
  /** Map of targetEntryId → sourceEntryIds that link to it */
  [targetEntryId: string]: string[];
}

// Parsed index for reads. Every mounted BacklinksPanel queries on each
// entry-changed event, so re-parsing the JSON blob per query does not scale.
// Writes still read the stored row inside their transaction, so the cache can
// only be stale for writes made by another tab.
let cache: BacklinksIndex | null = null;

registerDerivedSetting(SETTINGS_KEY, () => {
  cache = null;
});

/** Extract all entryLink target IDs from a block tree */
function extractEntryLinks(blocks: PartialBlock[]): string[] {
  const ids = new Set<string>();

  function walk(items: PartialBlock[]) {
    for (const block of items) {
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
      if (Array.isArray(block.children)) {
        walk(block.children);
      }
    }
  }

  walk(blocks);
  return [...ids];
}

function parseIndex(value: string | undefined): BacklinksIndex {
  if (!value) return {};
  try {
    return JSON.parse(value) as BacklinksIndex;
  } catch {
    return {};
  }
}

function removeSource(index: BacklinksIndex, sourceEntryId: string): void {
  for (const targetId of Object.keys(index)) {
    index[targetId] = index[targetId].filter((id) => id !== sourceEntryId);
    if (index[targetId].length === 0) delete index[targetId];
  }
}

/** Replaces the outgoing links of `sourceEntryId` in place. */
export function setSourceLinks(index: BacklinksIndex, sourceEntryId: string, blocks: PartialBlock[]): void {
  removeSource(index, sourceEntryId);
  for (const targetId of extractEntryLinks(blocks)) {
    if (targetId === sourceEntryId) continue; // skip self-links
    if (!index[targetId]) index[targetId] = [];
    if (!index[targetId].includes(sourceEntryId)) {
      index[targetId].push(sourceEntryId);
    }
  }
}

/** Removes an entry both as a link target and as a source, in place. */
export function removeEntryLinks(index: BacklinksIndex, entryId: string): void {
  delete index[entryId];
  removeSource(index, entryId);
}

/** Load, mutate and save in one transaction so concurrent writers cannot lose updates. */
async function mutateIndex(mutate: (index: BacklinksIndex) => void): Promise<void> {
  const db = await getDB();
  const tx = db.transaction("settings", "readwrite");
  const index = parseIndex((await tx.store.get(SETTINGS_KEY))?.value);
  mutate(index);
  await Promise.all([tx.store.put({ key: SETTINGS_KEY, value: JSON.stringify(index) }), tx.done]);
  cache = index;
}

/** Update backlinks index after an entry is saved */
export function updateBacklinks(sourceEntryId: string, blocks: PartialBlock[]): Promise<void> {
  return mutateIndex((index) => setSourceLinks(index, sourceEntryId, blocks));
}

/** Batch variant for import: one parse and one write for all entries. */
export function updateBacklinksBatch(sources: { id: string; blocks: PartialBlock[] }[]): Promise<void> {
  if (sources.length === 0) return Promise.resolve();
  return mutateIndex((index) => {
    for (const { id, blocks } of sources) setSourceLinks(index, id, blocks);
  });
}

/** Remove an entry from the backlinks index (when deleted) */
export function removeFromBacklinks(entryId: string): Promise<void> {
  return mutateIndex((index) => removeEntryLinks(index, entryId));
}

/** Get all entries that link TO this entry */
export async function getBacklinks(entryId: string): Promise<string[]> {
  if (!cache) {
    const db = await getDB();
    const stored = parseIndex((await db.get("settings", SETTINGS_KEY))?.value);
    // A write may have filled the cache with newer data while we were reading.
    cache ??= stored;
  }
  return cache[entryId] ?? [];
}
