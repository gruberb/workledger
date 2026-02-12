import { useState, useEffect, useCallback } from "react";
import type { WorkLedgerEntry } from "../types/entry.ts";
import {
  createEntry as dbCreateEntry,
  updateEntry as dbUpdateEntry,
  getEntry as dbGetEntry,
  getRecentEntries,
  archiveEntry as dbArchiveEntry,
  getAllDayKeys,
} from "../storage/entries.ts";
import { generateId } from "../utils/id.ts";
import { todayKey } from "../utils/dates.ts";

export function useEntries() {
  const [entriesByDay, setEntriesByDay] = useState<
    Map<string, WorkLedgerEntry[]>
  >(new Map());
  const [dayKeys, setDayKeys] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const [entries, keys] = await Promise.all([
      getRecentEntries(30),
      getAllDayKeys(),
    ]);
    setEntriesByDay(entries);
    setDayKeys(keys);
    setLoading(false);
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const createEntry = useCallback(async (): Promise<WorkLedgerEntry> => {
    const now = Date.now();
    const entry: WorkLedgerEntry = {
      id: generateId(),
      dayKey: todayKey(),
      createdAt: now,
      updatedAt: now,
      blocks: [],
      isArchived: false,
      tags: [],
    };
    await dbCreateEntry(entry);
    await refresh();
    return entry;
  }, [refresh]);

  const updateEntry = useCallback(
    async (entry: WorkLedgerEntry) => {
      await dbUpdateEntry(entry);
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
      await refresh();
    },
    [refresh],
  );

  return {
    entriesByDay,
    dayKeys,
    loading,
    createEntry,
    updateEntry,
    updateEntryTags,
    archiveEntry,
    refresh,
  };
}
