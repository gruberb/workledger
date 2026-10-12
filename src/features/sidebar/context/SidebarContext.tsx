import { createContext, useContext, useState, useEffect, useCallback, useMemo, type ReactNode } from "react";
import { useEntriesData, useEntriesActions } from "../../entries/index.ts";
import type { WorkLedgerEntry, EntrySignifier } from "../../entries/index.ts";
import { filterEntries } from "../utils/filterEntries.ts";
import type { SavedFilter } from "../types/saved-filter.ts";
import { loadSavedFilters, persistSavedFilters } from "../storage/saved-filters.ts";
import { savedFilterMatches } from "../utils/saved-filters.ts";
import { generateId } from "../../../utils/id.ts";
import { useIsMobile } from "../../../hooks/useIsMobile.ts";
import { todayKey } from "../../../utils/dates.ts";
import { isoWeekKey } from "../../../utils/weeks.ts";

// --- Context value types ---

export type SidebarView = "journal" | "review" | "archive";

interface SidebarUIValue {
  isOpen: boolean;
  toggleSidebar: () => void;
  setSidebarOpen: (open: boolean) => void;
  archiveView: boolean;
  toggleArchiveView: () => void;
  reviewView: boolean;
  toggleReviewView: () => void;
  /** ISO week shown by the weekly review; reset to the current week whenever the review opens. */
  reviewWeekKey: string;
  setReviewWeekKey: (weekKey: string) => void;
  /** Switches straight to a view; does nothing if it is already shown. */
  setView: (view: SidebarView) => void;
  activeDayKey: string | null;
  setActiveDayKey: (key: string | null) => void;
}

interface SidebarFilterValue {
  selectedTags: string[];
  toggleTag: (tag: string) => void;
  removeTag: (tag: string) => void;
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

  const isMobile = useIsMobile();
  const [isOpen, setIsOpen] = useState(() => !isMobile);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [archiveView, setArchiveView] = useState(false);
  const [reviewView, setReviewView] = useState(false);
  const [reviewWeekKey, setReviewWeekKey] = useState(() => isoWeekKey(todayKey()));
  const [activeDayKey, setActiveDayKey] = useState<string | null>(null);
  const [selectedSignifiers, setSelectedSignifiers] = useState<EntrySignifier[]>([]);

  // --- UI actions ---

  // Shrinking to mobile closes the sidebar so the drawer does not cover the
  // content. Widening keeps whatever the user had, so it never opens by itself.
  const [wasMobile, setWasMobile] = useState(isMobile);
  if (wasMobile !== isMobile) {
    setWasMobile(isMobile);
    if (isMobile) setIsOpen(false);
  }

  const toggleSidebar = useCallback(() => setIsOpen((prev) => !prev), []);
  const setSidebarOpen = useCallback((open: boolean) => setIsOpen(open), []);

  const toggleArchiveView = useCallback(() => {
    const next = !archiveView;
    setArchiveView(next);
    if (next) refreshArchive();
    // The signifier filter UI is hidden in the archive, so it must not
    // silently carry over and filter archived entries.
    setSelectedTags([]);
    setSelectedSignifiers([]);
    setReviewView(false);
  }, [archiveView, refreshArchive]);

  const toggleReviewView = useCallback(() => {
    if (!reviewView) setReviewWeekKey(isoWeekKey(todayKey()));
    setReviewView((prev) => !prev);
    if (archiveView) {
      setArchiveView(false);
    }
  }, [archiveView, reviewView]);

  const setView = useCallback((view: SidebarView) => {
    if (view === "archive") {
      if (!archiveView) toggleArchiveView();
    } else if (view === "review") {
      if (!reviewView) toggleReviewView();
    } else if (archiveView) {
      toggleArchiveView();
    } else if (reviewView) {
      toggleReviewView();
    }
  }, [archiveView, reviewView, toggleArchiveView, toggleReviewView]);

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
    setSelectedSignifiers([]);
  }, []);

  const hasActiveFilters = selectedTags.length > 0 || selectedSignifiers.length > 0;

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
      signifiers: selectedSignifiers,
    };
    const updated = [...savedFilters, filter];
    setSavedFilters(updated);
    await persistSavedFilters(updated);
  }, [selectedTags, selectedSignifiers, savedFilters]);

  const applySavedFilter = useCallback((filter: SavedFilter) => {
    // Toggle off if already active
    if (savedFilterMatches(filter, { tags: selectedTags, signifiers: selectedSignifiers })) {
      setSelectedTags([]);
        setSelectedSignifiers([]);
      return;
    }
    setSelectedTags(filter.tags);
    setSelectedSignifiers(filter.signifiers);
  }, [selectedTags, selectedSignifiers]);

  const deleteSavedFilter = useCallback(async (id: string) => {
    const updated = savedFilters.filter((f) => f.id !== id);
    setSavedFilters(updated);
    await persistSavedFilters(updated);
  }, [savedFilters]);

  // --- Computed data ---

  const displayEntriesByDay = useMemo(
    () => (hasActiveFilters ? filterEntries(entriesByDay, selectedTags, selectedSignifiers) : entriesByDay),
    [entriesByDay, selectedTags, selectedSignifiers, hasActiveFilters],
  );

  const sidebarDayKeys = useMemo(
    () => (hasActiveFilters ? [...displayEntriesByDay.keys()].sort((a, b) => b.localeCompare(a)) : dayKeys),
    [hasActiveFilters, displayEntriesByDay, dayKeys],
  );

  const displayArchivedEntriesByDay = useMemo(
    () => (hasActiveFilters ? filterEntries(archivedEntries, selectedTags, selectedSignifiers) : archivedEntries),
    [archivedEntries, selectedTags, selectedSignifiers, hasActiveFilters],
  );

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
    reviewWeekKey,
    setReviewWeekKey,
    setView,
    activeDayKey,
    setActiveDayKey,
  }), [isOpen, toggleSidebar, setSidebarOpen, archiveView, toggleArchiveView, reviewView, toggleReviewView, reviewWeekKey, setView, activeDayKey]);

  const filterValue: SidebarFilterValue = useMemo(() => ({
    selectedTags,
    toggleTag,
    removeTag,
    clearAllFilters,
    hasActiveFilters,
    selectedSignifiers,
    toggleSignifier,
    savedFilters,
    saveCurrentFilter,
    applySavedFilter,
    deleteSavedFilter,
  }), [selectedTags, toggleTag, removeTag, clearAllFilters, hasActiveFilters, selectedSignifiers, toggleSignifier, savedFilters, saveCurrentFilter, applySavedFilter, deleteSavedFilter]);

  const dataValue: SidebarDataValue = useMemo(() => ({
    isFiltering: hasActiveFilters,
    displayEntriesByDay,
    displayArchivedEntriesByDay,
    sidebarDayKeys,
    archivedDayKeys,
    allTags,
    allSignifiers,
    archivedCount,
    handleDeleteAll,
  }), [hasActiveFilters, displayEntriesByDay, displayArchivedEntriesByDay, sidebarDayKeys, archivedDayKeys, allTags, allSignifiers, archivedCount, handleDeleteAll]);

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
