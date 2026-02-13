import { createContext, useContext, type ReactNode } from "react";
import { useEntries } from "../hooks/useEntries.ts";
import type { WorkLedgerEntry } from "../types/entry.ts";

interface EntriesData {
  entriesByDay: Map<string, WorkLedgerEntry[]>;
  dayKeys: string[];
  loading: boolean;
  archivedEntries: Map<string, WorkLedgerEntry[]>;
}

interface EntriesActions {
  createEntry: () => Promise<WorkLedgerEntry>;
  updateEntry: (entry: WorkLedgerEntry) => Promise<void>;
  updateEntryTags: (entryId: string, dayKey: string, tags: string[]) => Promise<void>;
  archiveEntry: (id: string) => Promise<void>;
  unarchiveEntry: (id: string) => Promise<void>;
  deleteEntry: (id: string) => Promise<void>;
  refreshArchive: () => Promise<void>;
  refresh: () => Promise<void>;
  loadEntryById: (entryId: string) => Promise<WorkLedgerEntry | null>;
}

const EntriesDataContext = createContext<EntriesData | null>(null);
const EntriesActionsContext = createContext<EntriesActions | null>(null);

export function EntriesProvider({ children }: { children: ReactNode }) {
  const {
    entriesByDay,
    dayKeys,
    loading,
    createEntry,
    updateEntry,
    updateEntryTags,
    archiveEntry,
    unarchiveEntry,
    deleteEntry,
    archivedEntries,
    refreshArchive,
    refresh,
    loadEntryById,
  } = useEntries();

  const data: EntriesData = { entriesByDay, dayKeys, loading, archivedEntries };
  const actions: EntriesActions = {
    createEntry,
    updateEntry,
    updateEntryTags,
    archiveEntry,
    unarchiveEntry,
    deleteEntry,
    refreshArchive,
    refresh,
    loadEntryById,
  };

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
