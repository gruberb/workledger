import type { Block } from "@blocknote/core";
import type { WorkLedgerEntry } from "../types/entry.ts";
import { getDB } from "../../../storage/db.ts";
import { updateSearchIndex } from "./search-index.ts";

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
  URL.revokeObjectURL(url);
}

export async function importEntries(
  file: File,
): Promise<{ imported: number; skipped: number }> {
  const text = await file.text();
  const data = JSON.parse(text) as ExportEnvelope;

  if (data.version !== 1 || !Array.isArray(data.entries)) {
    throw new Error("Invalid export file format");
  }

  const db = await getDB();
  let imported = 0;
  let skipped = 0;

  for (const entry of data.entries) {
    const existing = await db.get("entries", entry.id);
    if (existing && !(existing as WorkLedgerEntry).isArchived) {
      skipped++;
      continue;
    }
    await db.put("entries", entry);
    if (entry.blocks?.length) {
      await updateSearchIndex(
        entry.id,
        entry.dayKey,
        entry.blocks as Block[],
        entry.tags ?? [],
      );
    }
    imported++;
  }

  return { imported, skipped };
}
