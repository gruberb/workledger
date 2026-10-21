import { createContext, useContext, useMemo, type ReactNode } from "react";
import { useEntries } from "../hooks/useEntries.ts";
import type { EntrySignifier, NewEntryOptions, WorkLedgerEntry } from "../types/entry.ts";
import type { PartialBlock } from "@blocknote/core";

interface EntriesData {
  /** Recent days plus pinned and on-demand days; every entry while filters are active. */
  entriesByDay: Map<string, WorkLedgerEntry[]>;
  dayKeys: string[];
  loading: boolean;
  /** Last load failure, cleared by the next successful refresh. */
  error: string | null;
  /** Empty until refreshArchive() is called (the archive view loads it). */
  archivedEntries: Map<string, WorkLedgerEntry[]>;
  /** Always current, even before the archive is loaded. */
  archivedCount: number;
  /** Tags and signifiers across all non-archived entries as of the last full read; loaded entries may add newer ones. */
  storedTags: string[];
  storedSignifiers: EntrySignifier[];
}

interface EntriesActions {
  createEntry: (options?: NewEntryOptions) => Promise<WorkLedgerEntry>;
  saveEntryContent: (entryId: string, blocks: PartialBlock[]) => Promise<void>;
  /** Appends inside one transaction, so a concurrent autosave can't be overwritten. False when the entry is gone. */
  appendEntryBlocks: (entryId: string, blocks: PartialBlock[]) => Promise<boolean>;
  updateEntryTags: (entryId: string, tags: string[]) => Promise<void>;
  archiveEntry: (id: string) => Promise<void>;
  unarchiveEntry: (id: string) => Promise<void>;
  deleteEntry: (id: string) => Promise<void>;
  deleteAllEntries: () => Promise<void>;
  pinEntry: (id: string) => Promise<void>;
  unpinEntry: (id: string) => Promise<void>;
  updateEntrySignifier: (id: string, signifier: EntrySignifier | undefined) => Promise<void>;
  refreshArchive: () => Promise<void>;
  refresh: () => Promise<void>;
  loadEntryById: (entryId: string) => Promise<WorkLedgerEntry | null>;
  loadDay: (dayKey: string) => Promise<WorkLedgerEntry[]>;
  setLoadAll: (loadAll: boolean) => void;
}

const EntriesDataContext = createContext<EntriesData | null>(null);
const EntriesActionsContext = createContext<EntriesActions | null>(null);

export function EntriesProvider({ children }: { children: ReactNode }) {
  const {
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
    appendEntryBlocks,
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
  } = useEntries();

  const data = useMemo<EntriesData>(
    () => ({ entriesByDay, dayKeys, loading, error, archivedEntries, archivedCount, storedTags, storedSignifiers }),
    [entriesByDay, dayKeys, loading, error, archivedEntries, archivedCount, storedTags, storedSignifiers],
  );
  const actions = useMemo<EntriesActions>(
    () => ({
      createEntry,
      saveEntryContent,
      appendEntryBlocks,
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
    }),
    [createEntry, saveEntryContent, appendEntryBlocks, updateEntryTags, archiveEntry, unarchiveEntry, deleteEntry, deleteAllEntries, pinEntry, unpinEntry, updateEntrySignifier, refreshArchive, refresh, loadEntryById, loadDay, setLoadAll],
  );

  return (
    <EntriesDataContext.Provider value={data}>
      <EntriesActionsContext.Provider value={actions}>
        {children}
      </EntriesActionsContext.Provider>
    </EntriesDataContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useEntriesData(): EntriesData {
  const ctx = useContext(EntriesDataContext);
  if (!ctx) throw new Error("useEntriesData must be used within EntriesProvider");
  return ctx;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useEntriesActions(): EntriesActions {
  const ctx = useContext(EntriesActionsContext);
  if (!ctx) throw new Error("useEntriesActions must be used within EntriesProvider");
  return ctx;
}
