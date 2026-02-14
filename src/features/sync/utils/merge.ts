import type { WorkLedgerEntry } from "../../entries/index.ts";
import { getEntry, deleteSearchIndex } from "../../entries/index.ts";
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

    const shouldOverwrite = !local || remote.updatedAt > local.updatedAt;

    if (shouldOverwrite) {
      const entry: WorkLedgerEntry = {
        id: remote.id,
        dayKey: remote.dayKey,
        createdAt: remote.createdAt,
        updatedAt: remote.updatedAt,
        blocks: remote.blocks as WorkLedgerEntry["blocks"],
        isArchived: remote.isArchived,
        tags: remote.tags ?? [],
      };
      await db.put("entries", entry);
      mergeCount++;
    }
  }

  return mergeCount;
}
