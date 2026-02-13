import { createContext, useContext, useState, useEffect, useCallback, useMemo, type ReactNode } from "react";
import { useEntriesData, useEntriesActions } from "../../entries/context/EntriesContext.tsx";
import { searchEntries, extractTextFromBlocks } from "../../entries/storage/search-index.ts";
import { clearAllData } from "../../../storage/db.ts";
import type { WorkLedgerEntry } from "../../entries/types/entry.ts";
import type { Block } from "@blocknote/core";

interface SidebarContextValue {
  isOpen: boolean;
  toggleSidebar: () => void;
  setSidebarOpen: (open: boolean) => void;
  filter: string;
  setFilter: (query: string) => void;
  clearFilter: () => void;
  archiveView: boolean;
  toggleArchiveView: () => void;
  activeDayKey: string | null;
  setActiveDayKey: (key: string | null) => void;
  displayEntriesByDay: Map<string, WorkLedgerEntry[]>;
  displayArchivedEntriesByDay: Map<string, WorkLedgerEntry[]>;
  sidebarDayKeys: string[];
  archivedDayKeys: string[];
  allTags: string[];
  archivedCount: number;
  handleDeleteAll: () => Promise<void>;
}

const SidebarCtx = createContext<SidebarContextValue | null>(null);

export function SidebarProvider({ children }: { children: ReactNode }) {
  const { entriesByDay, dayKeys, archivedEntries } = useEntriesData();
  const { refresh, refreshArchive } = useEntriesActions();

  const [isOpen, setIsOpen] = useState(true);
  const [filter, setFilter] = useState("");
  const [filteredEntryIds, setFilteredEntryIds] = useState<Set<string> | null>(null);
  const [archiveView, setArchiveView] = useState(false);
  const [activeDayKey, setActiveDayKey] = useState<string | null>(null);

  const toggleSidebar = useCallback(() => setIsOpen((prev) => !prev), []);
  const setSidebarOpen = useCallback((open: boolean) => setIsOpen(open), []);
  const clearFilter = useCallback(() => setFilter(""), []);

  // Debounced sidebar filter
  useEffect(() => {
    const timer = setTimeout(async () => {
      if (!filter.trim()) {
        setFilteredEntryIds(null);
        return;
      }
      const results = await searchEntries(filter);
      setFilteredEntryIds(new Set(results.map((r) => r.entryId)));
    }, 200);
    return () => clearTimeout(timer);
  }, [filter]);

  const displayEntriesByDay = useMemo(() => {
    if (!filter.trim()) return entriesByDay;
    const filterLower = filter.trim().toLowerCase();
    const filtered = new Map<string, WorkLedgerEntry[]>();
    for (const [dayKey, entries] of entriesByDay) {
      const matching = entries.filter((e) => {
        if (e.tags?.some((t) => t.toLowerCase().includes(filterLower))) return true;
        if (filteredEntryIds?.has(e.id)) return true;
        return false;
      });
      if (matching.length > 0) {
        filtered.set(dayKey, matching);
      }
    }
    return filtered;
  }, [entriesByDay, filteredEntryIds, filter]);

  const sidebarDayKeys = useMemo(
    () => (filter.trim() ? [...displayEntriesByDay.keys()].sort((a, b) => b.localeCompare(a)) : dayKeys),
    [filter, displayEntriesByDay, dayKeys],
  );

  const displayArchivedEntriesByDay = useMemo(() => {
    if (!filter.trim()) return archivedEntries;
    const filterLower = filter.trim().toLowerCase();
    const filtered = new Map<string, WorkLedgerEntry[]>();
    for (const [dayKey, entries] of archivedEntries) {
      const matching = entries.filter((e) => {
        if (e.tags?.some((t) => t.toLowerCase().includes(filterLower))) return true;
        if (e.blocks?.length) {
          const text = extractTextFromBlocks(e.blocks as Block[]).toLowerCase();
          if (text.includes(filterLower)) return true;
        }
        return false;
      });
      if (matching.length > 0) {
        filtered.set(dayKey, matching);
      }
    }
    return filtered;
  }, [archivedEntries, filter]);

  const archivedDayKeys = useMemo(
    () => [...displayArchivedEntriesByDay.keys()].sort((a, b) => b.localeCompare(a)),
    [displayArchivedEntriesByDay],
  );

  const allTags = useMemo(() => {
    const tagSet = new Set<string>();
    for (const entries of entriesByDay.values()) {
      for (const entry of entries) {
        for (const tag of entry.tags ?? []) {
          tagSet.add(tag);
        }
      }
    }
    return [...tagSet].sort((a, b) => a.localeCompare(b));
  }, [entriesByDay]);

  const archivedCount = useMemo(() => {
    let count = 0;
    for (const entries of archivedEntries.values()) {
      count += entries.length;
    }
    return count;
  }, [archivedEntries]);

  const toggleArchiveView = useCallback(() => {
    setArchiveView((prev) => {
      if (!prev) {
        refreshArchive();
      }
      return !prev;
    });
    setFilter("");
  }, [refreshArchive]);

  const handleDeleteAll = useCallback(async () => {
    await clearAllData();
    await refresh();
    await refreshArchive();
    setActiveDayKey(null);
  }, [refresh, refreshArchive]);

  const value: SidebarContextValue = {
    isOpen,
    toggleSidebar,
    setSidebarOpen,
    filter,
    setFilter,
    clearFilter,
    archiveView,
    toggleArchiveView,
    activeDayKey,
    setActiveDayKey,
    displayEntriesByDay,
    displayArchivedEntriesByDay,
    sidebarDayKeys,
    archivedDayKeys,
    allTags,
    archivedCount,
    handleDeleteAll,
  };

  return <SidebarCtx.Provider value={value}>{children}</SidebarCtx.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useSidebarContext(): SidebarContextValue {
  const ctx = useContext(SidebarCtx);
  if (!ctx) throw new Error("useSidebarContext must be used within SidebarProvider");
  return ctx;
}
