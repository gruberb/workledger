import { useState, useEffect, useCallback, useRef } from "react";
import type { Block, PartialBlock } from "@blocknote/core";
import type { EntrySignifier, WorkLedgerEntry } from "../types/entry.ts";
import {
  putEntry,
  patchEntry,
  getEntry,
  deleteEntry as dbDeleteEntry,
  getActiveEntriesForDay,
  getArchivedEntries,
  loadActiveSnapshot,
  type EntryPatch,
} from "../storage/entries.ts";
import { deleteSearchIndex, reindexEntry, updateSearchIndex } from "../storage/search-index.ts";
import { removeFromBacklinks, updateBacklinks } from "../storage/backlinks.ts";
import {
  addDayKey,
  removeFromMap,
  setDayInMap,
  updateInMap,
  upsertInMap,
  type EntriesByDay,
} from "../utils/entries-state.ts";
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

  // Days loaded on demand outside the recent window; kept across refreshes.
  const extraDaysRef = useRef(new Set<string>());
  const loadAllRef = useRef(false);
  // The archive is only read once the archive view asks for it.
  const archiveLoadedRef = useRef(false);

  const refreshArchive = useCallback(async () => {
    archiveLoadedRef.current = true;
    setArchivedEntries(await getArchivedEntries());
  }, []);

  /** Reloads everything currently in memory (callers: startup, import, sync pull, delete-all). */
  const refresh = useCallback(async () => {
    try {
      const snapshot = await loadActiveSnapshot({
        recentDays: RECENT_DAYS,
        extraDays: extraDaysRef.current,
        all: loadAllRef.current,
      });
      setEntriesByDay(snapshot.entriesByDay);
      setDayKeys(snapshot.dayKeys);
      setError(null);
      if (archiveLoadedRef.current) await refreshArchive();
    } catch (err) {
      console.error("[entries] load failed", err);
      setError(err instanceof Error ? err.message : "Could not load entries");
    } finally {
      setLoading(false);
    }
  }, [refreshArchive]);

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

  const createEntry = useCallback(async (options?: { blocks?: PartialBlock[]; tags?: string[] }): Promise<WorkLedgerEntry> => {
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
        updateSearchIndex(id, updated.dayKey, blocks as Block[], updated.tags, updated.updatedAt),
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
    emit("entry-changed", { entryId: id });
    await pruneDayKey(updated.dayKey);
  }, [pruneDayKey]);

  const unarchiveEntry = useCallback(async (id: string) => {
    const updated = await patchEntry(id, { isArchived: false });
    if (!updated) return;
    await updateIndexes("search index", () => reindexEntry(updated));
    setArchivedEntries((prev) => removeFromMap(prev, id));
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
    emit("entry-deleted", { entryId: id });
    if (entry && !entry.isArchived) await pruneDayKey(entry.dayKey);
  }, [pruneDayKey]);

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
    createEntry,
    saveEntryContent,
    updateEntryTags,
    archiveEntry,
    unarchiveEntry,
    deleteEntry,
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
