import { useState, useEffect, useCallback, useRef } from "react";
import type { PartialBlock } from "@blocknote/core";
import type { EntrySignifier, NewEntryOptions, WorkLedgerEntry } from "../types/entry.ts";
import {
  putEntry,
  patchEntry,
  getEntry,
  deleteEntry as dbDeleteEntry,
  getActiveEntriesForDay,
  loadActiveSnapshot,
  getAllEntryIds,
  type EntryPatch,
} from "../storage/entries.ts";
import { deleteSearchIndex, reindexEntry } from "../storage/search-index.ts";
import { removeFromBacklinks, updateBacklinks } from "../storage/backlinks.ts";
import {
  addDayKey,
  keepIfSame,
  removeFromMap,
  reuseUnchanged,
  setDayInMap,
  updateInMap,
  upsertInMap,
  type EntriesByDay,
} from "../utils/entries-state.ts";
import { clearAllData } from "../../../storage/db.ts";
import { generateId } from "../../../utils/id.ts";
import { todayKey } from "../../../utils/dates.ts";
import { emit } from "../../../utils/events.ts";
import { scrollToEntry } from "../../../utils/scroll.ts";

const RECENT_DAYS = 30;

/**
 * Index failures must not block or roll back the entry write itself; the
 * entry is the source of truth and indexes are rebuilt on its next save.
 */
async function updateIndexes(label: string, work: () => Promise<unknown>): Promise<void> {
  try {
    await work();
  } catch (err) {
    console.error(`[entries] ${label} failed`, err);
  }
}

export function useEntries() {
  const [entriesByDay, setEntriesByDay] = useState<EntriesByDay>(new Map());
  const [dayKeys, setDayKeys] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [archivedEntries, setArchivedEntries] = useState<EntriesByDay>(new Map());
  // Known from the startup scan, so the sidebar can show it before the archive loads.
  const [archivedCount, setArchivedCount] = useState(0);
  const [storedTags, setStoredTags] = useState<string[]>([]);
  const [storedSignifiers, setStoredSignifiers] = useState<EntrySignifier[]>([]);

  // Days loaded on demand outside the recent window; kept across refreshes.
  const extraDaysRef = useRef(new Set<string>());
  const loadAllRef = useRef(false);
  // Archived entries are only kept in memory once the archive view asks for them.
  const archiveLoadedRef = useRef(false);

  /**
   * Reloads everything currently in memory (callers: startup, import, sync pull,
   * delete-all, filter toggles). One scan covers both views.
   */
  const refresh = useCallback(async () => {
    try {
      const snapshot = await loadActiveSnapshot({
        recentDays: RECENT_DAYS,
        extraDays: extraDaysRef.current,
        all: loadAllRef.current,
        withArchive: archiveLoadedRef.current,
      });
      setEntriesByDay((prev) => reuseUnchanged(prev, snapshot.entriesByDay));
      setDayKeys((prev) => keepIfSame(prev, snapshot.dayKeys));
      setArchivedCount(snapshot.archivedCount);
      setStoredTags((prev) => keepIfSame(prev, snapshot.allTags));
      setStoredSignifiers((prev) => keepIfSame(prev, snapshot.allSignifiers));
      const archived = snapshot.archivedEntriesByDay;
      if (archived) setArchivedEntries((prev) => reuseUnchanged(prev, archived));
      setError(null);
    } catch (err) {
      console.error("[entries] load failed", err);
      setError(err instanceof Error ? err.message : "Could not load entries");
    } finally {
      setLoading(false);
    }
  }, []);

  const refreshArchive = useCallback(async () => {
    archiveLoadedRef.current = true;
    await refresh();
  }, [refresh]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  /** Loads a whole day into memory, e.g. when navigating to an old entry. */
  const loadDay = useCallback(async (dayKey: string) => {
    const dayEntries = await getActiveEntriesForDay(dayKey);
    extraDaysRef.current.add(dayKey);
    setEntriesByDay((prev) => setDayInMap(prev, dayKey, dayEntries));
    return dayEntries;
  }, []);

  /**
   * Filters run over in-memory entries, so while they are active every entry is
   * loaded (one scan when filtering starts). Clearing them trims back to the window.
   */
  const setLoadAll = useCallback((loadAll: boolean) => {
    if (loadAllRef.current === loadAll) return;
    loadAllRef.current = loadAll;
    refresh();
  }, [refresh]);

  /** Drops a day from dayKeys once it has no active entries left in storage. */
  const pruneDayKey = useCallback(async (dayKey: string) => {
    const remaining = await getActiveEntriesForDay(dayKey);
    if (remaining.length === 0) setDayKeys((prev) => prev.filter((k) => k !== dayKey));
  }, []);

  /**
   * Metadata changes keep the in-memory blocks reference, so open editors can
   * tell a tag/pin change apart from new content and leave the document alone.
   */
  const patchMetadata = useCallback(async (id: string, patch: EntryPatch) => {
    const updated = await patchEntry(id, patch);
    if (!updated) return undefined;
    const keepBlocks = (prev: WorkLedgerEntry) => ({ ...updated, blocks: prev.blocks });
    setEntriesByDay((prev) => updateInMap(prev, id, keepBlocks));
    setArchivedEntries((prev) => updateInMap(prev, id, keepBlocks));
    emit("entry-changed", { entryId: id });
    return updated;
  }, []);

  const createEntry = useCallback(async (options?: NewEntryOptions): Promise<WorkLedgerEntry> => {
    const now = Date.now();
    const entry: WorkLedgerEntry = {
      id: generateId(),
      dayKey: todayKey(),
      createdAt: now,
      updatedAt: now,
      blocks: options?.blocks ?? [],
      isArchived: false,
      tags: options?.tags ?? [],
      isPinned: false,
      ...(options?.signifier && { signifier: options.signifier }),
    };
    await putEntry(entry);
    // Template entries must be searchable and linkable before their first edit.
    if (entry.blocks.length > 0 || entry.tags.length > 0) {
      await updateIndexes("search index", () => reindexEntry(entry));
    }
    setEntriesByDay((prev) => upsertInMap(prev, entry));
    setDayKeys((prev) => addDayKey(prev, entry.dayKey));
    emit("entry-changed", { entryId: entry.id });
    return entry;
  }, []);

  const saveEntryContent = useCallback(async (id: string, blocks: PartialBlock[]) => {
    const updated = await patchEntry(id, { blocks });
    if (!updated) return; // deleted while the save was pending
    // `updated.blocks` is the caller's array; the editor compares by reference
    // to recognise its own save when the state comes back.
    setEntriesByDay((prev) => updateInMap(prev, id, () => updated));
    setArchivedEntries((prev) => updateInMap(prev, id, () => updated));
    if (!updated.isArchived) {
      await updateIndexes("search index", () =>
        reindexEntry(updated),
      );
    }
    // Before emitting: BacklinksPanel listeners read the index on entry-changed.
    await updateIndexes("backlinks", () => updateBacklinks(id, blocks));
    emit("entry-changed", { entryId: id });
  }, []);

  const updateEntryTags = useCallback(async (id: string, tags: string[]) => {
    const updated = await patchMetadata(id, { tags });
    if (updated) await updateIndexes("search index", () => reindexEntry(updated));
  }, [patchMetadata]);

  const archiveEntry = useCallback(async (id: string) => {
    const updated = await patchEntry(id, { isArchived: true });
    if (!updated) return;
    await updateIndexes("search index", () => deleteSearchIndex(id));
    setEntriesByDay((prev) => removeFromMap(prev, id));
    if (archiveLoadedRef.current) setArchivedEntries((prev) => upsertInMap(prev, updated));
    setArchivedCount((c) => c + 1);
    emit("entry-changed", { entryId: id });
    await pruneDayKey(updated.dayKey);
  }, [pruneDayKey]);

  const unarchiveEntry = useCallback(async (id: string) => {
    const updated = await patchEntry(id, { isArchived: false });
    if (!updated) return;
    await updateIndexes("search index", () => reindexEntry(updated));
    setArchivedEntries((prev) => removeFromMap(prev, id));
    setArchivedCount((c) => Math.max(0, c - 1));
    // Reload the whole day so the in-memory day stays complete.
    await loadDay(updated.dayKey);
    setDayKeys((prev) => addDayKey(prev, updated.dayKey));
    emit("entry-changed", { entryId: id });
  }, [loadDay]);

  const deleteEntry = useCallback(async (id: string) => {
    const entry = await getEntry(id);
    await dbDeleteEntry(id);
    await updateIndexes("search index", () => deleteSearchIndex(id));
    await updateIndexes("backlinks", () => removeFromBacklinks(id));
    setEntriesByDay((prev) => removeFromMap(prev, id));
    setArchivedEntries((prev) => removeFromMap(prev, id));
    if (entry?.isArchived) setArchivedCount((c) => Math.max(0, c - 1));
    emit("entry-deleted", { entryId: id });
    if (entry && !entry.isArchived) await pruneDayKey(entry.dayKey);
  }, [pruneDayKey]);

  const deleteAllEntries = useCallback(async () => {
    // Collect ids before clearing so sync can record a tombstone for each.
    const ids = await getAllEntryIds();
    await clearAllData();
    for (const id of ids) emit("entry-deleted", { entryId: id });
    await refresh();
  }, [refresh]);

  const pinEntry = useCallback(async (id: string) => {
    await patchMetadata(id, { isPinned: true });
    scrollToEntry(id);
  }, [patchMetadata]);

  const unpinEntry = useCallback(async (id: string) => {
    await patchMetadata(id, { isPinned: false });
  }, [patchMetadata]);

  const updateEntrySignifier = useCallback(async (id: string, signifier: EntrySignifier | undefined) => {
    await patchMetadata(id, { signifier });
  }, [patchMetadata]);

  const loadEntryById = useCallback(async (entryId: string): Promise<WorkLedgerEntry | null> => {
    const entry = await getEntry(entryId);
    if (!entry || entry.isArchived) return null;
    const dayEntries = await loadDay(entry.dayKey);
    return dayEntries.find((e) => e.id === entryId) ?? entry;
  }, [loadDay]);

  return {
    entriesByDay,
    dayKeys,
    loading,
    error,
    archivedEntries,
    archivedCount,
    storedTags,
    storedSignifiers,
    createEntry,
    saveEntryContent,
    updateEntryTags,
    archiveEntry,
    unarchiveEntry,
    deleteEntry,
    deleteAllEntries,
    pinEntry,
    unpinEntry,
    updateEntrySignifier,
    refreshArchive,
    refresh,
    loadEntryById,
    loadDay,
    setLoadAll,
  };
}
