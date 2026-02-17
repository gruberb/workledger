import { useState, useEffect, useCallback } from "react";
import type { WorkLedgerEntry } from "../types/entry.ts";
import {
  createEntry as dbCreateEntry,
  updateEntry as dbUpdateEntry,
  getEntry as dbGetEntry,
  getRecentEntries,
  archiveEntry as dbArchiveEntry,
  unarchiveEntry as dbUnarchiveEntry,
  deleteEntry as dbDeleteEntry,
  pinEntry as dbPinEntry,
  unpinEntry as dbUnpinEntry,
  updateEntrySignifier as dbUpdateEntrySignifier,
  getArchivedEntries,
  getAllDayKeys,
} from "../storage/entries.ts";
import { deleteSearchIndex, updateSearchIndex } from "../storage/search-index.ts";
import type { Block } from "@blocknote/core";
import { generateId } from "../../../utils/id.ts";
import { todayKey } from "../../../utils/dates.ts";
import { emit } from "../../../utils/events.ts";

export function useEntries() {
  const [entriesByDay, setEntriesByDay] = useState<
    Map<string, WorkLedgerEntry[]>
  >(new Map());
  const [dayKeys, setDayKeys] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [archivedEntries, setArchivedEntries] = useState<
    Map<string, WorkLedgerEntry[]>
  >(new Map());

  const refresh = useCallback(async () => {
    const [entries, keys] = await Promise.all([
      getRecentEntries(30),
      getAllDayKeys(),
    ]);
    setEntriesByDay(entries);
    setDayKeys(keys);
    setLoading(false);
  }, []);

  const refreshArchive = useCallback(async () => {
    const archived = await getArchivedEntries();
    setArchivedEntries(archived);
  }, []);

  useEffect(() => {
    // Initial data load — setState in refresh/refreshArchive is intentional
    // eslint-disable-next-line react-hooks/set-state-in-effect
    refresh();
    refreshArchive();
  }, [refresh, refreshArchive]);

  const createEntry = useCallback(async (options?: { blocks?: WorkLedgerEntry["blocks"]; tags?: string[] }): Promise<WorkLedgerEntry> => {
    const now = Date.now();
    const entry: WorkLedgerEntry = {
      id: generateId(),
      dayKey: todayKey(),
      createdAt: now,
      updatedAt: now,
      blocks: options?.blocks ?? [],
      isArchived: false,
      tags: options?.tags ?? [],
    };
    await dbCreateEntry(entry);
    emit("entry-changed", { entryId: entry.id });
    await refresh();
    return entry;
  }, [refresh]);

  const updateEntry = useCallback(
    async (entry: WorkLedgerEntry) => {
      await dbUpdateEntry(entry);
      emit("entry-changed", { entryId: entry.id });
      setEntriesByDay((prev) => {
        const next = new Map(prev);
        const dayEntries = [...(next.get(entry.dayKey) || [])];
        const idx = dayEntries.findIndex((e) => e.id === entry.id);
        if (idx >= 0) {
          dayEntries[idx] = entry;
        } else {
          dayEntries.unshift(entry);
        }
        next.set(entry.dayKey, dayEntries);
        return next;
      });
    },
    [],
  );

  const updateEntryTags = useCallback(
    async (entryId: string, dayKey: string, tags: string[]) => {
      const entry = await dbGetEntry(entryId);
      if (!entry) return;
      const updated: WorkLedgerEntry = {
        ...entry,
        tags,
        updatedAt: Date.now(),
      };
      await dbUpdateEntry(updated);
      emit("entry-changed", { entryId });
      setEntriesByDay((prev) => {
        const next = new Map(prev);
        const dayEntries = [...(next.get(dayKey) || [])];
        const idx = dayEntries.findIndex((e) => e.id === entryId);
        if (idx >= 0) {
          dayEntries[idx] = updated;
          next.set(dayKey, dayEntries);
        }
        return next;
      });
    },
    [],
  );

  const archiveEntry = useCallback(
    async (id: string) => {
      await dbArchiveEntry(id);
      emit("entry-changed", { entryId: id });
      await deleteSearchIndex(id);
      await refresh();
      await refreshArchive();
    },
    [refresh, refreshArchive],
  );

  const unarchiveEntry = useCallback(
    async (id: string) => {
      const entry = await dbGetEntry(id);
      await dbUnarchiveEntry(id);
      emit("entry-changed", { entryId: id });
      if (entry?.blocks?.length) {
        await updateSearchIndex(
          entry.id,
          entry.dayKey,
          entry.blocks as Block[],
          entry.tags ?? [],
        );
      }
      await refresh();
      await refreshArchive();
    },
    [refresh, refreshArchive],
  );

  const deleteEntry = useCallback(
    async (id: string) => {
      await dbDeleteEntry(id);
      emit("entry-deleted", { entryId: id });
      await deleteSearchIndex(id);
      await refresh();
      await refreshArchive();
    },
    [refresh, refreshArchive],
  );

  const pinEntry = useCallback(
    async (id: string) => {
      await dbPinEntry(id);
      emit("entry-changed", { entryId: id });
      await refresh();
      setTimeout(() => {
        document.getElementById(`entry-${id}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
      }, 100);
    },
    [refresh],
  );

  const unpinEntry = useCallback(
    async (id: string) => {
      await dbUnpinEntry(id);
      emit("entry-changed", { entryId: id });
      await refresh();
    },
    [refresh],
  );

  const updateEntrySignifier = useCallback(
    async (id: string, signifier: string | undefined) => {
      await dbUpdateEntrySignifier(id, signifier);
      emit("entry-changed", { entryId: id });
      await refresh();
    },
    [refresh],
  );

  const loadEntryById = useCallback(
    async (entryId: string): Promise<WorkLedgerEntry | null> => {
      const entry = await dbGetEntry(entryId);
      if (!entry || entry.isArchived) return null;
      setEntriesByDay((prev) => {
        const next = new Map(prev);
        const dayEntries = [...(next.get(entry.dayKey) || [])];
        if (!dayEntries.some((e) => e.id === entry.id)) {
          dayEntries.unshift(entry);
          next.set(entry.dayKey, dayEntries);
        }
        return next;
      });
      return entry;
    },
    [],
  );

  return {
    entriesByDay,
    dayKeys,
    loading,
    createEntry,
    updateEntry,
    updateEntryTags,
    archiveEntry,
    unarchiveEntry,
    deleteEntry,
    pinEntry,
    unpinEntry,
    updateEntrySignifier,
    archivedEntries,
    refreshArchive,
    refresh,
    loadEntryById,
  };
}
