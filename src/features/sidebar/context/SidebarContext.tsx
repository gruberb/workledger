import { createContext, useContext, useState, useEffect, useCallback, useMemo, type ReactNode } from "react";
import { useEntriesData, useEntriesActions, searchEntries, extractTextFromBlocks } from "../../entries/index.ts";
import type { WorkLedgerEntry, EntrySignifier } from "../../entries/index.ts";
import type { Block } from "@blocknote/core";
import { filterEntries } from "../utils/filterEntries.ts";
import type { SavedFilter } from "../types/saved-filter.ts";
import { loadSavedFilters, persistSavedFilters } from "../storage/saved-filters.ts";
import { savedFilterMatches } from "../utils/saved-filters.ts";
import { generateId } from "../../../utils/id.ts";

// Filtering re-renders the whole entry stream, so it follows typing with a delay.
const FILTER_DEBOUNCE_MS = 200;

function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);
  return debounced;
}

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
  /** Filters currently applied to the display maps (the text part is debounced). */
  isFiltering: boolean;
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
  const { entriesByDay, dayKeys, archivedEntries, archivedCount, storedTags, storedSignifiers } = useEntriesData();
  const { refreshArchive, deleteAllEntries } = useEntriesActions();

  const [isOpen, setIsOpen] = useState(
    () => !window.matchMedia("(max-width: 767px)").matches,
  );
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [textQuery, setTextQuery] = useState("");
  const [filteredEntryIds, setFilteredEntryIds] = useState<Set<string> | null>(null);
  const [archiveView, setArchiveView] = useState(false);
  const [reviewView, setReviewView] = useState(false);
  const [activeDayKey, setActiveDayKey] = useState<string | null>(null);
  const [selectedSignifiers, setSelectedSignifiers] = useState<EntrySignifier[]>([]);

  // --- UI actions ---

  const toggleSidebar = useCallback(() => setIsOpen((prev) => !prev), []);
  const setSidebarOpen = useCallback((open: boolean) => setIsOpen(open), []);

  const toggleArchiveView = useCallback(() => {
    const next = !archiveView;
    setArchiveView(next);
    if (next) refreshArchive();
    // The signifier filter UI is hidden in the archive, so it must not
    // silently carry over and filter archived entries.
    setSelectedTags([]);
    setTextQuery("");
    setSelectedSignifiers([]);
    setReviewView(false);
  }, [archiveView, refreshArchive]);

  const toggleReviewView = useCallback(() => {
    setReviewView((prev) => !prev);
    if (archiveView) {
      setArchiveView(false);
    }
  }, [archiveView]);

  // --- Filter actions ---

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
      signifiers: selectedSignifiers,
    };
    const updated = [...savedFilters, filter];
    setSavedFilters(updated);
    await persistSavedFilters(updated);
  }, [selectedTags, textQuery, selectedSignifiers, savedFilters]);

  const applySavedFilter = useCallback((filter: SavedFilter) => {
    // Toggle off if already active
    if (savedFilterMatches(filter, { tags: selectedTags, textQuery, signifiers: selectedSignifiers })) {
      setSelectedTags([]);
      setTextQuery("");
      setSelectedSignifiers([]);
      return;
    }
    setSelectedTags(filter.tags);
    setTextQuery(filter.textQuery);
    setSelectedSignifiers(filter.signifiers);
  }, [selectedTags, textQuery, selectedSignifiers]);

  const deleteSavedFilter = useCallback(async (id: string) => {
    const updated = savedFilters.filter((f) => f.id !== id);
    setSavedFilters(updated);
    await persistSavedFilters(updated);
  }, [savedFilters]);

  // --- Computed data ---

  // textQuery drives the input; filterQuery drives the (expensive) filtering.
  const filterQuery = useDebouncedValue(textQuery, FILTER_DEBOUNCE_MS).trim();
  const hasDisplayFilters = selectedTags.length > 0 || filterQuery !== "" || selectedSignifiers.length > 0;

  // Re-run on entry changes too: autosave updates the search index before
  // entriesByDay, so edited or new entries get their match state refreshed.
  useEffect(() => {
    if (!filterQuery) return;
    let cancelled = false;
    searchEntries(filterQuery).then((results) => {
      if (!cancelled) setFilteredEntryIds(new Set(results.map((r) => r.entryId)));
    });
    return () => { cancelled = true; };
  }, [filterQuery, entriesByDay]);

  const displayEntriesByDay = useMemo(() => {
    if (!hasDisplayFilters) return entriesByDay;
    return filterEntries(entriesByDay, selectedTags, filterQuery, (e) => !!filteredEntryIds?.has(e.id), selectedSignifiers);
  }, [entriesByDay, filteredEntryIds, selectedTags, filterQuery, selectedSignifiers, hasDisplayFilters]);

  const sidebarDayKeys = useMemo(
    () => (hasDisplayFilters ? [...displayEntriesByDay.keys()].sort((a, b) => b.localeCompare(a)) : dayKeys),
    [hasDisplayFilters, displayEntriesByDay, dayKeys],
  );

  // Archived entries are not in the search index, so their text is matched in
  // memory. Extract it once per archive load, not once per keystroke.
  const archivedText = useMemo(() => {
    const text = new Map<string, string>();
    for (const entries of archivedEntries.values()) {
      for (const e of entries) {
        text.set(e.id, e.blocks?.length ? extractTextFromBlocks(e.blocks as Block[]).toLowerCase() : "");
      }
    }
    return text;
  }, [archivedEntries]);

  const displayArchivedEntriesByDay = useMemo(() => {
    if (!hasDisplayFilters) return archivedEntries;
    const textLower = filterQuery.toLowerCase();
    return filterEntries(archivedEntries, selectedTags, filterQuery, (e) => !!archivedText.get(e.id)?.includes(textLower), selectedSignifiers);
  }, [archivedEntries, archivedText, selectedTags, filterQuery, selectedSignifiers, hasDisplayFilters]);

  const archivedDayKeys = useMemo(
    () => [...displayArchivedEntriesByDay.keys()].sort((a, b) => b.localeCompare(a)),
    [displayArchivedEntriesByDay],
  );

  // Only recent days are in memory, so start from the tags of every stored entry
  // (collected by the last full read) and add edits made since.
  const allTags = useMemo(() => {
    const tagSet = new Set<string>(storedTags);
    for (const entries of entriesByDay.values()) {
      for (const entry of entries) {
        for (const tag of entry.tags ?? []) {
          tagSet.add(tag);
        }
      }
    }
    return [...tagSet].sort((a, b) => a.localeCompare(b));
  }, [entriesByDay, storedTags]);

  const allSignifiers = useMemo(() => {
    const set = new Set<string>(storedSignifiers);
    for (const entries of entriesByDay.values()) {
      for (const entry of entries) {
        if (entry.signifier) set.add(entry.signifier);
      }
    }
    return [...set];
  }, [entriesByDay, storedSignifiers]);

  const handleDeleteAll = useCallback(async () => {
    await deleteAllEntries();
    setActiveDayKey(null);
  }, [deleteAllEntries]);

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
    isFiltering: hasDisplayFilters,
    displayEntriesByDay,
    displayArchivedEntriesByDay,
    sidebarDayKeys,
    archivedDayKeys,
    allTags,
    allSignifiers,
    archivedCount,
    handleDeleteAll,
  }), [hasDisplayFilters, displayEntriesByDay, displayArchivedEntriesByDay, sidebarDayKeys, archivedDayKeys, allTags, allSignifiers, archivedCount, handleDeleteAll]);

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
