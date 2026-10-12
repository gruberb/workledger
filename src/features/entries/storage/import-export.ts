import type { WorkLedgerEntry } from "../types/entry.ts";
import { getDB } from "../../../storage/db.ts";
import { emit } from "../../../utils/events.ts";
import { normalizeEntry } from "./entries.ts";
import { toSearchRow } from "./search-index.ts";
import { updateBacklinksBatch } from "./backlinks.ts";
import { validateEntry, validateImportEnvelope } from "../utils/validation.ts";

interface ExportEnvelope {
  version: number;
  exportedAt: string;
  entryCount: number;
  entries: WorkLedgerEntry[];
}

export async function exportAllEntries(): Promise<void> {
  const db = await getDB();
  const entries = (await db.getAll("entries")) as WorkLedgerEntry[];

  const envelope: ExportEnvelope = {
    version: 1,
    exportedAt: new Date().toISOString(),
    entryCount: entries.length,
    entries,
  };

  const blob = new Blob([JSON.stringify(envelope, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const date = new Date().toISOString().slice(0, 10);
  const a = document.createElement("a");
  a.href = url;
  a.download = `workledger-export-${date}.json`;
  a.click();
  // Revoking synchronously can cancel the download in some browsers.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export async function importEntries(
  file: File,
): Promise<{ imported: number; skipped: number; invalid: number }> {
  const text = await file.text();
  const envelope = validateImportEnvelope(JSON.parse(text));

  const valid: WorkLedgerEntry[] = [];
  let invalid = 0;
  for (const raw of envelope.entries) {
    try {
      valid.push(normalizeEntry(validateEntry(raw)));
    } catch {
      invalid++;
    }
  }

  return { ...(await saveImportedEntries(valid)), invalid };
}

/**
 * Writes entries from any import source and keeps every derived index and sync
 * in step. An existing entry is only replaced by a strictly newer version, so
 * re-importing the same data is a no-op and local edits made after an import win.
 */
export async function saveImportedEntries(
  valid: WorkLedgerEntry[],
): Promise<{ imported: number; skipped: number }> {
  // Entries and their search rows commit together. Only IDB requests are awaited
  // inside, so the transaction stays open for the whole batch.
  const db = await getDB();
  const tx = db.transaction(["entries", "searchIndex"], "readwrite");
  const entryStore = tx.objectStore("entries");
  const searchStore = tx.objectStore("searchIndex");
  const imported: WorkLedgerEntry[] = [];
  for (const entry of valid) {
    const existing = await entryStore.get(entry.id);
    // Same rule as sync merge: never replace a local version that is as new or newer.
    if (existing && existing.updatedAt >= entry.updatedAt) continue;
    await entryStore.put(entry);
    if (entry.isArchived) {
      await searchStore.delete(entry.id);
    } else {
      await searchStore.put(toSearchRow(entry));
    }
    imported.push(entry);
  }
  await tx.done;

  await updateBacklinksBatch(imported.map((e) => ({ id: e.id, blocks: e.blocks })));
  // Imported entries keep their original updatedAt, so sync's timestamp fallback
  // would never push them. The event marks them dirty.
  for (const entry of imported) {
    emit("entry-changed", { entryId: entry.id });
  }

  return { imported: imported.length, skipped: valid.length - imported.length };
}
