import type { WorkLedgerEntry } from "../types/entry.ts";
import { getDB } from "../../../storage/db.ts";

function normalizeEntry(raw: Record<string, unknown>): WorkLedgerEntry {
  const entry = raw as unknown as WorkLedgerEntry;
  return { ...entry, tags: entry.tags ?? [] };
}

export async function createEntry(
  entry: WorkLedgerEntry,
): Promise<WorkLedgerEntry> {
  const db = await getDB();
  await db.put("entries", entry);
  return entry;
}

export async function updateEntry(
  entry: WorkLedgerEntry,
): Promise<WorkLedgerEntry> {
  const db = await getDB();
  await db.put("entries", entry);
  return entry;
}

export async function getEntry(id: string): Promise<WorkLedgerEntry | undefined> {
  const db = await getDB();
  const raw = await db.get("entries", id);
  return raw ? normalizeEntry(raw as Record<string, unknown>) : undefined;
}

export async function getEntriesByDay(
  dayKey: string,
): Promise<WorkLedgerEntry[]> {
  const db = await getDB();
  const entries = await db.getAllFromIndex("entries", "by-dayKey", dayKey);
  return (entries as unknown as Record<string, unknown>[])
    .map(normalizeEntry)
    .filter((e) => !e.isArchived)
    .sort((a, b) => b.createdAt - a.createdAt);
}

export async function getAllDayKeys(): Promise<string[]> {
  const db = await getDB();
  const entries = await db.getAll("entries");
  const normalized = (entries as unknown as Record<string, unknown>[]).map(normalizeEntry);
  const keys = new Set(
    normalized.filter((e) => !e.isArchived).map((e) => e.dayKey),
  );
  return [...keys].sort((a, b) => b.localeCompare(a));
}

export async function getRecentEntries(
  limit: number = 30,
): Promise<Map<string, WorkLedgerEntry[]>> {
  const db = await getDB();
  const allEntries = await db.getAll("entries");
  const active = (allEntries as unknown as Record<string, unknown>[])
    .map(normalizeEntry)
    .filter((e) => !e.isArchived)
    .sort((a, b) => b.createdAt - a.createdAt);

  const grouped = new Map<string, WorkLedgerEntry[]>();
  const daysSeen = new Set<string>();

  for (const entry of active) {
    if (daysSeen.size >= limit && !daysSeen.has(entry.dayKey)) break;
    daysSeen.add(entry.dayKey);
    const existing = grouped.get(entry.dayKey) || [];
    existing.push(entry);
    grouped.set(entry.dayKey, existing);
  }

  return grouped;
}

export async function archiveEntry(id: string): Promise<void> {
  const db = await getDB();
  const raw = await db.get("entries", id);
  if (raw) {
    const entry = normalizeEntry(raw as Record<string, unknown>);
    entry.isArchived = true;
    entry.updatedAt = Date.now();
    await db.put("entries", entry);
  }
}

export async function unarchiveEntry(id: string): Promise<void> {
  const db = await getDB();
  const raw = await db.get("entries", id);
  if (raw) {
    const entry = normalizeEntry(raw as Record<string, unknown>);
    entry.isArchived = false;
    entry.updatedAt = Date.now();
    await db.put("entries", entry);
  }
}

export async function deleteEntry(id: string): Promise<void> {
  const db = await getDB();
  await db.delete("entries", id);
}

export async function getArchivedEntries(): Promise<Map<string, WorkLedgerEntry[]>> {
  const db = await getDB();
  const allEntries = await db.getAll("entries");
  const archived = (allEntries as unknown as Record<string, unknown>[])
    .map(normalizeEntry)
    .filter((e) => e.isArchived)
    .sort((a, b) => b.createdAt - a.createdAt);

  const grouped = new Map<string, WorkLedgerEntry[]>();
  for (const entry of archived) {
    const existing = grouped.get(entry.dayKey) || [];
    existing.push(entry);
    grouped.set(entry.dayKey, existing);
  }

  return grouped;
}

export async function getAllTags(): Promise<string[]> {
  const db = await getDB();
  const allEntries = await db.getAll("entries");
  const tagSet = new Set<string>();
  for (const raw of allEntries) {
    const entry = normalizeEntry(raw as unknown as Record<string, unknown>);
    if (!entry.isArchived) {
      for (const tag of entry.tags) {
        tagSet.add(tag);
      }
    }
  }
  return [...tagSet].sort((a, b) => a.localeCompare(b));
}
