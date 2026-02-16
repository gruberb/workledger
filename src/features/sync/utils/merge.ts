import type { WorkLedgerEntry } from "../../entries/index.ts";
import { getEntry, deleteSearchIndex, updateSearchIndex, validateEntry } from "../../entries/index.ts";
import type { Block } from "@blocknote/core";
import { getDB } from "../../../storage/db.ts";

interface DecryptedRemoteEntry {
  id: string;
  dayKey: string;
  createdAt: number;
  updatedAt: number;
  blocks: unknown[];
  isArchived: boolean;
  isDeleted: boolean;
  tags: string[];
}

export async function mergeRemoteEntries(
  remoteEntries: DecryptedRemoteEntry[],
): Promise<number> {
  const db = await getDB();
  let mergeCount = 0;

  for (const remote of remoteEntries) {
    const local = await getEntry(remote.id);

    if (remote.isDeleted) {
      if (local) {
        await db.delete("entries", remote.id);
        await deleteSearchIndex(remote.id);
        mergeCount++;
      }
      continue;
    }

    // Validate non-deleted remote entries before writing to IDB
    let validatedEntry: WorkLedgerEntry;
    try {
      validatedEntry = validateEntry(remote) as WorkLedgerEntry;
    } catch (err) {
      console.warn(`[sync] Entry ${remote.id} failed validation:`, err instanceof Error ? err.message : err);
      continue;
    }

    const shouldOverwrite = !local || remote.updatedAt > local.updatedAt;

    if (shouldOverwrite) {
      await db.put("entries", validatedEntry);
      if (validatedEntry.blocks?.length) {
        await updateSearchIndex(
          validatedEntry.id,
          validatedEntry.dayKey,
          validatedEntry.blocks as Block[],
          validatedEntry.tags ?? [],
        );
      }
      mergeCount++;
    }
  }

  return mergeCount;
}
