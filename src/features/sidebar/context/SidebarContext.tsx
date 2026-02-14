import { createContext, useContext, useState, useEffect, useCallback, useMemo, type ReactNode } from "react";
import { useEntriesData, useEntriesActions, searchEntries, extractTextFromBlocks } from "../../entries/index.ts";
import type { WorkLedgerEntry } from "../../entries/index.ts";
import { clearAllData } from "../../../storage/db.ts";
import { useSyncContext } from "../../sync/index.ts";
import type { Block } from "@blocknote/core";

interface SidebarContextValue {
  isOpen: boolean;
  toggleSidebar: () => void;
  setSidebarOpen: (open: boolean) => void;
  selectedTags: string[];
  toggleTag: (tag: string) => void;
  removeTag: (tag: string) => void;
  textQuery: string;
  setTextQuery: (query: string) => void;
  clearAllFilters: () => void;
  hasActiveFilters: boolean;
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
  const { deleteAccount, config: syncConfig } = useSyncContext();

  const [isOpen, setIsOpen] = useState(
    () => !window.matchMedia("(max-width: 767px)").matches,
  );
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [textQuery, setTextQuery] = useState("");
  const [filteredEntryIds, setFilteredEntryIds] = useState<Set<string> | null>(null);
  const [archiveView, setArchiveView] = useState(false);
  const [activeDayKey, setActiveDayKey] = useState<string | null>(null);

  const toggleSidebar = useCallback(() => setIsOpen((prev) => !prev), []);
  const setSidebarOpen = useCallback((open: boolean) => setIsOpen(open), []);

  const toggleTag = useCallback((tag: string) => {
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );
  }, []);

  const removeTag = useCallback((tag: string) => {
    setSelectedTags((prev) => prev.filter((t) => t !== tag));
  }, []);

  const clearAllFilters = useCallback(() => {
    setSelectedTags([]);
    setTextQuery("");
  }, []);

  const hasActiveFilters = selectedTags.length > 0 || textQuery.trim() !== "";

  // Debounced text search
  useEffect(() => {
    const timer = setTimeout(async () => {
      if (!textQuery.trim()) {
        setFilteredEntryIds(null);
        return;
      }
      const results = await searchEntries(textQuery);
      setFilteredEntryIds(new Set(results.map((r) => r.entryId)));
    }, 200);
    return () => clearTimeout(timer);
  }, [textQuery]);

  const displayEntriesByDay = useMemo(() => {
    const hasTagFilter = selectedTags.length > 0;
    const hasTextFilter = textQuery.trim() !== "";
    if (!hasTagFilter && !hasTextFilter) return entriesByDay;

    const textLower = textQuery.trim().toLowerCase();
    const filtered = new Map<string, WorkLedgerEntry[]>();
    for (const [dayKey, entries] of entriesByDay) {
      const matching = entries.filter((e) => {
        // Tag filter: entry must have every selected tag (exact match, AND logic)
        if (hasTagFilter) {
          const entryTags = e.tags ?? [];
          if (!selectedTags.every((st) => entryTags.includes(st))) return false;
        }
        // Text filter: search index + in-memory tag substring match
        if (hasTextFilter) {
          const tagMatch = e.tags?.some((t) => t.toLowerCase().includes(textLower));
          const indexMatch = filteredEntryIds?.has(e.id);
          if (!tagMatch && !indexMatch) return false;
        }
        return true;
      });
      if (matching.length > 0) {
        filtered.set(dayKey, matching);
      }
    }
    return filtered;
  }, [entriesByDay, filteredEntryIds, selectedTags, textQuery]);

  const sidebarDayKeys = useMemo(
    () => (hasActiveFilters ? [...displayEntriesByDay.keys()].sort((a, b) => b.localeCompare(a)) : dayKeys),
    [hasActiveFilters, displayEntriesByDay, dayKeys],
  );

  const displayArchivedEntriesByDay = useMemo(() => {
    const hasTagFilter = selectedTags.length > 0;
    const hasTextFilter = textQuery.trim() !== "";
    if (!hasTagFilter && !hasTextFilter) return archivedEntries;

    const textLower = textQuery.trim().toLowerCase();
    const filtered = new Map<string, WorkLedgerEntry[]>();
    for (const [dayKey, entries] of archivedEntries) {
      const matching = entries.filter((e) => {
        if (hasTagFilter) {
          const entryTags = e.tags ?? [];
          if (!selectedTags.every((st) => entryTags.includes(st))) return false;
        }
        if (hasTextFilter) {
          const tagMatch = e.tags?.some((t) => t.toLowerCase().includes(textLower));
          let textMatch = false;
          if (e.blocks?.length) {
            const text = extractTextFromBlocks(e.blocks as Block[]).toLowerCase();
            if (text.includes(textLower)) textMatch = true;
          }
          if (!tagMatch && !textMatch) return false;
        }
        return true;
      });
      if (matching.length > 0) {
        filtered.set(dayKey, matching);
      }
    }
    return filtered;
  }, [archivedEntries, selectedTags, textQuery]);

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
    setSelectedTags([]);
    setTextQuery("");
  }, [refreshArchive]);

  const handleDeleteAll = useCallback(async () => {
    if (syncConfig.mode === "remote") {
      await deleteAccount();
    }
    await clearAllData();
    await refresh();
    await refreshArchive();
    setActiveDayKey(null);
  }, [refresh, refreshArchive, syncConfig.mode, deleteAccount]);

  const value: SidebarContextValue = {
    isOpen,
    toggleSidebar,
    setSidebarOpen,
    selectedTags,
    toggleTag,
    removeTag,
    textQuery,
    setTextQuery,
    clearAllFilters,
    hasActiveFilters,
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
