import { createContext, useContext, useState, useEffect, useCallback, useMemo, type ReactNode } from "react";
import { useEntriesData, useEntriesActions, searchEntries, extractTextFromBlocks } from "../../entries/index.ts";
import type { WorkLedgerEntry, EntrySignifier } from "../../entries/index.ts";
import { clearAllData, getDB } from "../../../storage/db.ts";
import { emit } from "../../../utils/events.ts";
import type { Block } from "@blocknote/core";
import { filterEntries } from "../utils/filterEntries.ts";
import type { SavedFilter } from "../types/saved-filter.ts";
import { loadSavedFilters, persistSavedFilters } from "../storage/saved-filters.ts";
import { generateId } from "../../../utils/id.ts";

// --- Context value types ---

interface SidebarUIValue {
  isOpen: boolean;
  toggleSidebar: () => void;
  setSidebarOpen: (open: boolean) => void;
  archiveView: boolean;
  toggleArchiveView: () => void;
  reviewView: boolean;
  toggleReviewView: () => void;
  activeDayKey: string | null;
  setActiveDayKey: (key: string | null) => void;
}

interface SidebarFilterValue {
  selectedTags: string[];
  toggleTag: (tag: string) => void;
  removeTag: (tag: string) => void;
  textQuery: string;
  setTextQuery: (query: string) => void;
  clearAllFilters: () => void;
  hasActiveFilters: boolean;
  selectedSignifiers: EntrySignifier[];
  toggleSignifier: (signifier: EntrySignifier) => void;
  savedFilters: SavedFilter[];
  saveCurrentFilter: (name: string) => Promise<void>;
  applySavedFilter: (filter: SavedFilter) => void;
  deleteSavedFilter: (id: string) => Promise<void>;
}

interface SidebarDataValue {
  displayEntriesByDay: Map<string, WorkLedgerEntry[]>;
  displayArchivedEntriesByDay: Map<string, WorkLedgerEntry[]>;
  sidebarDayKeys: string[];
  archivedDayKeys: string[];
  allTags: string[];
  allSignifiers: string[];
  archivedCount: number;
  handleDeleteAll: () => Promise<void>;
}

// --- Contexts ---

const SidebarUICtx = createContext<SidebarUIValue | null>(null);
const SidebarFilterCtx = createContext<SidebarFilterValue | null>(null);
const SidebarDataCtx = createContext<SidebarDataValue | null>(null);

// --- Provider ---

export function SidebarProvider({ children }: { children: ReactNode }) {
  const { entriesByDay, dayKeys, archivedEntries } = useEntriesData();
  const { refresh, refreshArchive } = useEntriesActions();

  const [isOpen, setIsOpen] = useState(
    () => !window.matchMedia("(max-width: 767px)").matches,
  );
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [textQuery, setTextQuery] = useState("");
  const [filteredEntryIds, setFilteredEntryIds] = useState<Set<string> | null>(null);
  const [archiveView, setArchiveView] = useState(false);
  const [reviewView, setReviewView] = useState(false);
  const [activeDayKey, setActiveDayKey] = useState<string | null>(null);

  // --- UI actions ---

  const toggleSidebar = useCallback(() => setIsOpen((prev) => !prev), []);
  const setSidebarOpen = useCallback((open: boolean) => setIsOpen(open), []);

  const toggleArchiveView = useCallback(() => {
    setArchiveView((prev) => {
      if (!prev) {
        refreshArchive();
      }
      return !prev;
    });
    setSelectedTags([]);
    setTextQuery("");
    setReviewView(false);
  }, [refreshArchive]);

  const toggleReviewView = useCallback(() => {
    setReviewView((prev) => !prev);
    if (archiveView) {
      setArchiveView(false);
    }
  }, [archiveView]);

  // --- Filter actions ---

  const [selectedSignifiers, setSelectedSignifiers] = useState<EntrySignifier[]>([]);

  const toggleTag = useCallback((tag: string) => {
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );
  }, []);

  const removeTag = useCallback((tag: string) => {
    setSelectedTags((prev) => prev.filter((t) => t !== tag));
  }, []);

  const toggleSignifier = useCallback((signifier: EntrySignifier) => {
    setSelectedSignifiers((prev) =>
      prev.includes(signifier) ? prev.filter((s) => s !== signifier) : [...prev, signifier]
    );
  }, []);

  const clearAllFilters = useCallback(() => {
    setSelectedTags([]);
    setTextQuery("");
    setSelectedSignifiers([]);
  }, []);

  const hasActiveFilters = selectedTags.length > 0 || textQuery.trim() !== "" || selectedSignifiers.length > 0;

  // --- Saved filters ---

  const [savedFilters, setSavedFilters] = useState<SavedFilter[]>([]);

  useEffect(() => {
    loadSavedFilters().then(setSavedFilters);
  }, []);

  const saveCurrentFilter = useCallback(async (name: string) => {
    const filter: SavedFilter = {
      id: generateId(),
      name,
      tags: selectedTags,
      textQuery,
    };
    const updated = [...savedFilters, filter];
    setSavedFilters(updated);
    await persistSavedFilters(updated);
  }, [selectedTags, textQuery, savedFilters]);

  const applySavedFilter = useCallback((filter: SavedFilter) => {
    // Toggle off if already active
    const sameTags = filter.tags.length === selectedTags.length && filter.tags.every((t) => selectedTags.includes(t));
    const sameQuery = filter.textQuery === textQuery;
    if (sameTags && sameQuery) {
      setSelectedTags([]);
      setTextQuery("");
      setSelectedSignifiers([]);
      return;
    }
    setSelectedTags(filter.tags);
    setTextQuery(filter.textQuery);
    setSelectedSignifiers([]);
  }, [selectedTags, textQuery]);

  const deleteSavedFilter = useCallback(async (id: string) => {
    const updated = savedFilters.filter((f) => f.id !== id);
    setSavedFilters(updated);
    await persistSavedFilters(updated);
  }, [savedFilters]);

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

  // --- Computed data ---

  const displayEntriesByDay = useMemo(() => {
    if (!hasActiveFilters) return entriesByDay;
    return filterEntries(entriesByDay, selectedTags, textQuery, (e) => !!filteredEntryIds?.has(e.id), selectedSignifiers);
  }, [entriesByDay, filteredEntryIds, selectedTags, textQuery, selectedSignifiers, hasActiveFilters]);

  const sidebarDayKeys = useMemo(
    () => (hasActiveFilters ? [...displayEntriesByDay.keys()].sort((a, b) => b.localeCompare(a)) : dayKeys),
    [hasActiveFilters, displayEntriesByDay, dayKeys],
  );

  const displayArchivedEntriesByDay = useMemo(() => {
    if (!hasActiveFilters) return archivedEntries;
    const textLower = textQuery.trim().toLowerCase();
    return filterEntries(archivedEntries, selectedTags, textQuery, (e) => {
      if (!e.blocks?.length) return false;
      const text = extractTextFromBlocks(e.blocks as Block[]).toLowerCase();
      return text.includes(textLower);
    }, selectedSignifiers);
  }, [archivedEntries, selectedTags, textQuery, selectedSignifiers, hasActiveFilters]);

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

  const allSignifiers = useMemo(() => {
    const set = new Set<string>();
    for (const entries of entriesByDay.values()) {
      for (const entry of entries) {
        if (entry.signifier) set.add(entry.signifier);
      }
    }
    return [...set];
  }, [entriesByDay]);

  const archivedCount = useMemo(() => {
    let count = 0;
    for (const entries of archivedEntries.values()) {
      count += entries.length;
    }
    return count;
  }, [archivedEntries]);

  const handleDeleteAll = useCallback(async () => {
    // Collect all entry IDs before clearing so sync can create deletion tombstones
    const db = await getDB();
    const entryIds = await db.getAllKeys("entries");
    await clearAllData();
    for (const id of entryIds) {
      emit("entry-deleted", { entryId: id as string });
    }
    await refresh();
    await refreshArchive();
    setActiveDayKey(null);
  }, [refresh, refreshArchive]);

  // --- Context values (stable via useMemo) ---

  const uiValue: SidebarUIValue = useMemo(() => ({
    isOpen,
    toggleSidebar,
    setSidebarOpen,
    archiveView,
    toggleArchiveView,
    reviewView,
    toggleReviewView,
    activeDayKey,
    setActiveDayKey,
  }), [isOpen, toggleSidebar, setSidebarOpen, archiveView, toggleArchiveView, reviewView, toggleReviewView, activeDayKey]);

  const filterValue: SidebarFilterValue = useMemo(() => ({
    selectedTags,
    toggleTag,
    removeTag,
    textQuery,
    setTextQuery,
    clearAllFilters,
    hasActiveFilters,
    selectedSignifiers,
    toggleSignifier,
    savedFilters,
    saveCurrentFilter,
    applySavedFilter,
    deleteSavedFilter,
  }), [selectedTags, toggleTag, removeTag, textQuery, clearAllFilters, hasActiveFilters, selectedSignifiers, toggleSignifier, savedFilters, saveCurrentFilter, applySavedFilter, deleteSavedFilter]);

  const dataValue: SidebarDataValue = useMemo(() => ({
    displayEntriesByDay,
    displayArchivedEntriesByDay,
    sidebarDayKeys,
    archivedDayKeys,
    allTags,
    allSignifiers,
    archivedCount,
    handleDeleteAll,
  }), [displayEntriesByDay, displayArchivedEntriesByDay, sidebarDayKeys, archivedDayKeys, allTags, allSignifiers, archivedCount, handleDeleteAll]);

  return (
    <SidebarUICtx.Provider value={uiValue}>
      <SidebarFilterCtx.Provider value={filterValue}>
        <SidebarDataCtx.Provider value={dataValue}>
          {children}
        </SidebarDataCtx.Provider>
      </SidebarFilterCtx.Provider>
    </SidebarUICtx.Provider>
  );
}

// --- Hooks ---

// eslint-disable-next-line react-refresh/only-export-components
export function useSidebarUI(): SidebarUIValue {
  const ctx = useContext(SidebarUICtx);
  if (!ctx) throw new Error("useSidebarUI must be used within SidebarProvider");
  return ctx;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useSidebarFilter(): SidebarFilterValue {
  const ctx = useContext(SidebarFilterCtx);
  if (!ctx) throw new Error("useSidebarFilter must be used within SidebarProvider");
  return ctx;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useSidebarData(): SidebarDataValue {
  const ctx = useContext(SidebarDataCtx);
  if (!ctx) throw new Error("useSidebarData must be used within SidebarProvider");
  return ctx;
}

// Convenience hook that returns all three — for consumers that need everything
// eslint-disable-next-line react-refresh/only-export-components
export function useSidebarContext() {
  return { ...useSidebarUI(), ...useSidebarFilter(), ...useSidebarData() };
}
