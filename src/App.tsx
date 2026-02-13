import { useState, useEffect, useCallback, useMemo } from "react";
import { AppShell } from "./components/layout/AppShell.tsx";
import { Sidebar } from "./components/layout/Sidebar.tsx";
import { EntryStream } from "./components/entries/EntryStream.tsx";
import { NewEntryButton } from "./components/entries/NewEntryButton.tsx";
import { SearchPanel } from "./components/search/SearchPanel.tsx";
import { AISidebar } from "./components/ai/AISidebar.tsx";
import { useEntries } from "./hooks/useEntries.ts";
import { useSearch } from "./hooks/useSearch.ts";
import { useAISettings } from "./hooks/useAISettings.ts";
import { useAIFeatureGate } from "./hooks/useAIFeatureGate.ts";
import { searchEntries, extractTextFromBlocks } from "./storage/search-index.ts";
import { clearAllData } from "./storage/db.ts";
import type { Block } from "@blocknote/core";
import type { WorkLedgerEntry } from "./types/entry.ts";

export default function App() {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [sidebarFilter, setSidebarFilter] = useState("");

  const [filteredEntryIds, setFilteredEntryIds] = useState<Set<string> | null>(null);
  const [archiveView, setArchiveView] = useState(false);
  const [activeDayKey, setActiveDayKey] = useState<string | null>(null);
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
  const { query, results, isOpen: searchOpen, search, open: openSearch, close: closeSearch } = useSearch();

  // AI state
  const { settings: aiSettings, updateSettings: updateAISettings } = useAISettings();
  const { available: aiAvailable } = useAIFeatureGate(aiSettings);
  const [aiSidebarOpen, setAISidebarOpen] = useState(false);
  const [aiTargetEntry, setAITargetEntry] = useState<WorkLedgerEntry | null>(null);

  // Auto-collapse left sidebar when both sidebars open on narrow screens
  useEffect(() => {
    if (!aiSidebarOpen || !sidebarOpen) return;
    const check = () => {
      if (window.innerWidth < 1200) {
        setSidebarOpen(false);
      }
    };
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, [aiSidebarOpen, sidebarOpen]);

  // Debounced sidebar filter
  useEffect(() => {
    const timer = setTimeout(async () => {
      if (!sidebarFilter.trim()) {
        setFilteredEntryIds(null);
        return;
      }
      const results = await searchEntries(sidebarFilter);
      setFilteredEntryIds(new Set(results.map((r) => r.entryId)));
    }, 200);

    return () => clearTimeout(timer);
  }, [sidebarFilter]);

  // Compute filtered entries for the main content area
  // Combines search index results with direct in-memory tag matching
  const displayEntriesByDay = useMemo(() => {
    if (!sidebarFilter.trim()) return entriesByDay;
    const filterLower = sidebarFilter.trim().toLowerCase();
    const filtered = new Map<string, WorkLedgerEntry[]>();
    for (const [dayKey, entries] of entriesByDay) {
      const matching = entries.filter((e) => {
        // Match by tag directly (handles entries not yet in search index)
        if (e.tags?.some((t) => t.toLowerCase().includes(filterLower))) return true;
        // Match by search index results
        if (filteredEntryIds?.has(e.id)) return true;
        return false;
      });
      if (matching.length > 0) {
        filtered.set(dayKey, matching);
      }
    }
    return filtered;
  }, [entriesByDay, filteredEntryIds, sidebarFilter]);

  const sidebarDayKeys = useMemo(
    () => (sidebarFilter.trim() ? [...displayEntriesByDay.keys()].sort((a, b) => b.localeCompare(a)) : dayKeys),
    [sidebarFilter, displayEntriesByDay, dayKeys],
  );

  const clearFilter = useCallback(() => {
    setSidebarFilter("");
  }, []);

  // Collect all unique tags from entries
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

  const handleNewEntry = useCallback(async () => {
    const entry = await createEntry();
    setTimeout(() => {
      document.getElementById(`entry-${entry.id}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 100);
  }, [createEntry]);

  const handleDayClick = useCallback((dayKey: string) => {
    setActiveDayKey(dayKey);
    const el = document.getElementById(`day-${dayKey}`);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, []);

  const handleSearchResultClick = useCallback((entryId: string) => {
    const el = document.getElementById(`entry-${entryId}`);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, []);

  const navigateToEntry = useCallback(
    async (entryId: string) => {
      const scrollAndHighlight = (el: HTMLElement) => {
        el.scrollIntoView({ behavior: "smooth", block: "center" });
        el.classList.add("entry-link-highlight");
        setTimeout(() => el.classList.remove("entry-link-highlight"), 2000);
        // Focus the editor inside the entry
        setTimeout(() => {
          const editorEl = el.querySelector<HTMLElement>("[contenteditable=true]");
          if (editorEl) editorEl.focus();
        }, 400);
      };

      // Find the entry's dayKey from current state to highlight sidebar
      for (const [dayKey, entries] of entriesByDay) {
        if ((entries as { id: string }[]).some((e) => e.id === entryId)) {
          setActiveDayKey(dayKey);
          break;
        }
      }

      const existing = document.getElementById(`entry-${entryId}`);
      if (existing) {
        scrollAndHighlight(existing);
        return;
      }

      const entry = await loadEntryById(entryId);
      if (!entry) {
        console.warn(`Entry ${entryId} not found or archived`);
        return;
      }
      setActiveDayKey(entry.dayKey);

      setTimeout(() => {
        const el = document.getElementById(`entry-${entryId}`);
        if (el) scrollAndHighlight(el);
      }, 150);
    },
    [loadEntryById, entriesByDay],
  );

  useEffect(() => {
    const handler = (e: Event) => {
      const entryId = (e as CustomEvent).detail?.entryId;
      if (entryId) navigateToEntry(entryId);
    };
    window.addEventListener("workledger:navigate-entry", handler);
    return () => window.removeEventListener("workledger:navigate-entry", handler);
  }, [navigateToEntry]);

  const handleTagsChange = useCallback(
    (entryId: string, dayKey: string, tags: string[]) => {
      updateEntryTags(entryId, dayKey, tags);
    },
    [updateEntryTags],
  );

  const handleDeleteAll = useCallback(async () => {
    await clearAllData();
    await refresh();
    await refreshArchive();
    setActiveDayKey(null);
  }, [refresh, refreshArchive]);

  const handleToggleArchiveView = useCallback(() => {
    setArchiveView((prev) => {
      if (!prev) {
        refreshArchive();
      }
      return !prev;
    });
    setSidebarFilter("");
  }, [refreshArchive]);

  // Compute filtered archive entries for archive view
  // Since archived entries are removed from the search index, filter in-memory
  const displayArchivedEntriesByDay = useMemo(() => {
    if (!sidebarFilter.trim()) return archivedEntries;
    const filterLower = sidebarFilter.trim().toLowerCase();
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
  }, [archivedEntries, sidebarFilter]);

  // Compute archive data for sidebar
  const archivedDayKeys = useMemo(
    () => [...displayArchivedEntriesByDay.keys()].sort((a, b) => b.localeCompare(a)),
    [displayArchivedEntriesByDay],
  );

  const archivedCount = useMemo(() => {
    let count = 0;
    for (const entries of archivedEntries.values()) {
      count += entries.length;
    }
    return count;
  }, [archivedEntries]);

  // AI handlers
  const handleToggleAI = useCallback(() => {
    const newEnabled = !aiSettings.enabled;
    updateAISettings({ enabled: newEnabled });
    if (!newEnabled) {
      setAISidebarOpen(false);
    }
  }, [aiSettings.enabled, updateAISettings]);

  const handleOpenAI = useCallback((entry: WorkLedgerEntry) => {
    setAITargetEntry(entry);
    setAISidebarOpen(true);
  }, []);

  const handleToggleAISidebar = useCallback(() => {
    setAISidebarOpen((prev) => !prev);
  }, []);

  // Global keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "j") {
        e.preventDefault();
        if (!archiveView) handleNewEntry();
      }
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        if (searchOpen) {
          closeSearch();
        } else {
          openSearch();
        }
      }
      if ((e.metaKey || e.ctrlKey) && e.key === "\\") {
        e.preventDefault();
        setSidebarOpen((prev) => !prev);
      }
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && (e.key === "i" || e.key === "I")) {
        e.preventDefault();
        if (aiSettings.enabled) {
          handleToggleAISidebar();
        }
      }
      if (e.key === "Escape" && sidebarFilter) {
        setSidebarFilter("");
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [handleNewEntry, searchOpen, closeSearch, openSearch, sidebarFilter, archiveView, aiSettings.enabled, handleToggleAISidebar]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#fafafa] flex items-center justify-center">
        <div className="text-stone-400 text-sm">Loading notebook...</div>
      </div>
    );
  }

  return (
    <>
      <Sidebar
        dayKeys={archiveView ? archivedDayKeys : sidebarDayKeys}
        entriesByDay={archiveView ? (displayArchivedEntriesByDay as Map<string, unknown[]>) : (displayEntriesByDay as Map<string, unknown[]>)}
        isOpen={sidebarOpen}
        onToggle={() => setSidebarOpen((prev) => !prev)}
        onDayClick={handleDayClick}
        sidebarSearchQuery={sidebarFilter}
        onSidebarSearch={setSidebarFilter}
        onSearchOpen={openSearch}
        allTags={allTags}
        onTagClick={(tag) => setSidebarFilter(tag)}
        onRefresh={refresh}
        isArchiveView={archiveView}
        onToggleArchiveView={handleToggleArchiveView}
        archivedCount={archivedCount}
        activeDayKey={activeDayKey}
        onDeleteAll={handleDeleteAll}
        aiEnabled={aiSettings.enabled}
        onToggleAI={handleToggleAI}
      />

      <AppShell sidebarOpen={sidebarOpen} aiSidebarOpen={aiSidebarOpen}>
        <EntryStream
          entriesByDay={archiveView ? displayArchivedEntriesByDay : displayEntriesByDay}
          onSave={updateEntry}
          onTagsChange={archiveView ? undefined : handleTagsChange}
          onArchive={archiveView ? undefined : archiveEntry}
          onDelete={deleteEntry}
          onUnarchive={archiveView ? unarchiveEntry : undefined}
          isArchiveView={archiveView}
          filterQuery={sidebarFilter}
          onClearFilter={clearFilter}
          onOpenAI={aiSettings.enabled && aiAvailable ? handleOpenAI : undefined}
        />
      </AppShell>

      {!archiveView && <NewEntryButton onClick={handleNewEntry} />}

      <SearchPanel
        isOpen={searchOpen}
        query={query}
        results={results}
        onSearch={search}
        onClose={closeSearch}
        onResultClick={handleSearchResultClick}
      />

      {aiSettings.enabled && (
        <AISidebar
          isOpen={aiSidebarOpen}
          onClose={handleToggleAISidebar}
          settings={aiSettings}
          onUpdateSettings={updateAISettings}
          targetEntry={aiTargetEntry}
        />
      )}
    </>
  );
}
