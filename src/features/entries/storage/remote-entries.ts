import type { WorkLedgerEntry } from "../types/entry.ts";
import { getDB } from "../../../storage/db.ts";
import { validateEntry } from "../utils/validation.ts";
import { toSearchRow } from "./search-index.ts";
import { updateBacklinksBatch, removeFromBacklinks } from "./backlinks.ts";

/** An entry received from another device. `data` is untrusted and validated here. */
export type RemoteEntry =
  | { id: string; isDeleted: true; updatedAt: number }
  | { id: string; isDeleted: false; updatedAt: number; data: unknown };

/**
 * Apply remote entries with last-write-wins and keep every derived index
 * (search, backlinks) in step with the entries store.
 *
 * Equal timestamps keep the local version. Deletions always win.
 * Returns the number of local entries that changed.
 */
export async function applyRemoteEntries(remote: RemoteEntry[]): Promise<number> {
  const incoming: Array<{ id: string; entry: WorkLedgerEntry | null }> = [];
  for (const r of remote) {
    if (r.isDeleted) {
      incoming.push({ id: r.id, entry: null });
      continue;
    }
    try {
      const data = r.data as Record<string, unknown>;
      incoming.push({ id: r.id, entry: validateEntry({ ...data, id: r.id }) as WorkLedgerEntry });
    } catch (err) {
      console.warn(`[sync] Entry ${r.id} failed validation:`, err instanceof Error ? err.message : err);
    }
  }
  if (incoming.length === 0) return 0;

  // One transaction for the whole page: thousands of per-entry transactions
  // made initial sync slow, and a partial page can no longer be left behind.
  const db = await getDB();
  const tx = db.transaction(["entries", "searchIndex"], "readwrite");
  const entries = tx.objectStore("entries");
  const searchIndex = tx.objectStore("searchIndex");
  const upserted: WorkLedgerEntry[] = [];
  const deleted: string[] = [];

  for (const { id, entry } of incoming) {
    const local = await entries.get(id);
    if (!entry) {
      if (local) {
        await entries.delete(id);
        await searchIndex.delete(id);
        deleted.push(id);
      }
      continue;
    }
    if (local && entry.updatedAt <= local.updatedAt) continue;

    await entries.put(entry);
    // Archived entries are kept out of search, matching archiveEntry().
    if (entry.isArchived) {
      await searchIndex.delete(id);
    } else {
      await searchIndex.put(toSearchRow(entry));
    }
    upserted.push(entry);
  }
  await tx.done;

  // The backlinks index is a single settings row: batch upserts into one
  // parse and write. Remote deletes are rare, so they go one at a time.
  await updateBacklinksBatch(upserted.map((e) => ({ id: e.id, blocks: e.blocks })));
  for (const id of deleted) await removeFromBacklinks(id);

  return upserted.length + deleted.length;
}
