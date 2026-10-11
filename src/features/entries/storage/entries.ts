import type { WorkLedgerEntry } from "../types/entry.ts";
import { isEntrySignifier } from "../types/entry.ts";
import { getDB } from "../../../storage/db.ts";
import { buildActiveSnapshot, type ActiveSnapshot, type EntriesByDay, type SnapshotOptions } from "../utils/entries-state.ts";

/** Fields a caller may change; identity and timestamps are owned by storage. */
export type EntryPatch = Partial<Pick<WorkLedgerEntry, "blocks" | "tags" | "isArchived" | "isPinned" | "signifier">>;

export function normalizeEntry(raw: unknown): WorkLedgerEntry {
  const entry = raw as WorkLedgerEntry;
  return {
    ...entry,
    tags: entry.tags ?? [],
    isPinned: entry.isPinned ?? false,
    // Guards rows written by older app versions or devices before migration.
    signifier: isEntrySignifier(entry.signifier) ? entry.signifier : undefined,
  };
}

/**
 * Strictly increases per entry. Merge is last-write-wins on updatedAt, so a
 * device whose clock lags must still produce a version newer than the one it read.
 */
export function nextUpdatedAt(previous: number, now: number = Date.now()): number {
  return Math.max(now, previous + 1);
}

export function applyPatch(entry: WorkLedgerEntry, patch: EntryPatch, now: number = Date.now()): WorkLedgerEntry {
  return { ...entry, ...patch, updatedAt: nextUpdatedAt(entry.updatedAt, now) };
}

export async function putEntry(entry: WorkLedgerEntry): Promise<void> {
  const db = await getDB();
  await db.put("entries", entry);
}

/**
 * Read-modify-write in one transaction so concurrent writers (autosave, pin,
 * tags) cannot overwrite each other's fields. Returns undefined when the entry
 * no longer exists, e.g. a pending autosave firing after delete.
 */
export async function patchEntry(id: string, patch: EntryPatch): Promise<WorkLedgerEntry | undefined> {
  const db = await getDB();
  const tx = db.transaction("entries", "readwrite");
  const raw = await tx.store.get(id);
  if (!raw) {
    await tx.done;
    return undefined;
  }
  const updated = applyPatch(normalizeEntry(raw), patch);
  await Promise.all([tx.store.put(updated), tx.done]);
  return updated;
}

export async function deleteEntry(id: string): Promise<void> {
  const db = await getDB();
  await db.delete("entries", id);
}

export async function getEntry(id: string): Promise<WorkLedgerEntry | undefined> {
  const db = await getDB();
  const raw = await db.get("entries", id);
  return raw ? normalizeEntry(raw) : undefined;
}

/** Fetches several entries in one transaction; missing ids are skipped. */
export async function getEntries(ids: string[]): Promise<WorkLedgerEntry[]> {
  const db = await getDB();
  const tx = db.transaction("entries");
  const rows = await Promise.all(ids.map((id) => tx.store.get(id)));
  return rows.filter((row) => row !== undefined).map(normalizeEntry);
}

export async function getActiveEntriesForDay(dayKey: string): Promise<WorkLedgerEntry[]> {
  const db = await getDB();
  const rows = await db.getAllFromIndex("entries", "by-dayKey", dayKey);
  return rows
    .map(normalizeEntry)
    .filter((e) => !e.isArchived)
    .sort((a, b) => b.createdAt - a.createdAt);
}

/**
 * One getAll instead of a cursor: pinned entries and archive-free day keys need
 * every row's values anyway (booleans are not valid IndexedDB keys, so neither
 * can be indexed), and a bulk getAll is much faster than a cursor walk.
 */
export async function loadActiveSnapshot(options: SnapshotOptions): Promise<ActiveSnapshot> {
  return buildActiveSnapshot(await getAllEntries(), options);
}

export async function getArchivedEntries(): Promise<EntriesByDay> {
  const archived = (await getAllEntries())
    .filter((e) => e.isArchived)
    .sort((a, b) => b.createdAt - a.createdAt);

  const grouped: EntriesByDay = new Map();
  for (const entry of archived) {
    const existing = grouped.get(entry.dayKey) || [];
    existing.push(entry);
    grouped.set(entry.dayKey, existing);
  }
  return grouped;
}

export async function getAllEntries(): Promise<WorkLedgerEntry[]> {
  const db = await getDB();
  return (await db.getAll("entries")).map(normalizeEntry);
}

export async function getAllEntryIds(): Promise<string[]> {
  const db = await getDB();
  return (await db.getAllKeys("entries")) as string[];
}
