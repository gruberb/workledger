import { useState, useEffect, useCallback, useMemo } from "react";
import { AppShell } from "./components/layout/AppShell.tsx";
import { Sidebar } from "./components/layout/Sidebar.tsx";
import { EntryStream } from "./components/entries/EntryStream.tsx";
import { NewEntryButton } from "./components/entries/NewEntryButton.tsx";
import { SearchPanel } from "./components/search/SearchPanel.tsx";
import { useEntries } from "./hooks/useEntries.ts";
import { useSearch } from "./hooks/useSearch.ts";
import { searchEntries } from "./storage/search-index.ts";

export default function App() {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [sidebarFilter, setSidebarFilter] = useState("");
  const [filteredDayKeys, setFilteredDayKeys] = useState<string[] | null>(null);
  const [filteredEntryIds, setFilteredEntryIds] = useState<Set<string> | null>(null);
  const {
    entriesByDay,
    dayKeys,
    loading,
    createEntry,
    updateEntry,
    updateEntryTags,
    archiveEntry,
  } = useEntries();
  const { query, results, isOpen: searchOpen, search, open: openSearch, close: closeSearch } = useSearch();

  // Debounced sidebar filter
  useEffect(() => {
    if (!sidebarFilter.trim()) {
      setFilteredDayKeys(null);
      setFilteredEntryIds(null);
      return;
    }

    const timer = setTimeout(async () => {
      const results = await searchEntries(sidebarFilter);
      const matchingDays = [...new Set(results.map((r) => r.dayKey))];
      const matchingIds = new Set(results.map((r) => r.entryId));
      setFilteredDayKeys(matchingDays);
      setFilteredEntryIds(matchingIds);
    }, 200);

    return () => clearTimeout(timer);
  }, [sidebarFilter]);

  // Compute filtered entries for the main content area
  // Combines search index results with direct in-memory tag matching
  const displayEntriesByDay = useMemo(() => {
    if (!sidebarFilter.trim()) return entriesByDay;
    const filterLower = sidebarFilter.trim().toLowerCase();
    const filtered = new Map<string, import("./types/entry.ts").WorkLedgerEntry[]>();
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
    const el = document.getElementById(`day-${dayKey}`);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, []);

  const handleSearchResultClick = useCallback((entryId: string, _dayKey: string) => {
    const el = document.getElementById(`entry-${entryId}`);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, []);

  const handleTagsChange = useCallback(
    (entryId: string, dayKey: string, tags: string[]) => {
      updateEntryTags(entryId, dayKey, tags);
    },
    [updateEntryTags],
  );

  // Global keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "j") {
        e.preventDefault();
        handleNewEntry();
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
      if (e.key === "Escape" && sidebarFilter) {
        setSidebarFilter("");
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [handleNewEntry, searchOpen, closeSearch, openSearch, sidebarFilter]);

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
        dayKeys={sidebarDayKeys}
        entriesByDay={displayEntriesByDay as Map<string, unknown[]>}
        isOpen={sidebarOpen}
        onToggle={() => setSidebarOpen((prev) => !prev)}
        onDayClick={handleDayClick}
        sidebarSearchQuery={sidebarFilter}
        onSidebarSearch={setSidebarFilter}
        onSearchOpen={openSearch}
        allTags={allTags}
        onTagClick={(tag) => setSidebarFilter(tag)}
      />

      <AppShell sidebarOpen={sidebarOpen}>
        <EntryStream
          entriesByDay={displayEntriesByDay}
          onSave={updateEntry}
          onTagsChange={handleTagsChange}
          onArchive={archiveEntry}
          filterQuery={sidebarFilter}
          onClearFilter={clearFilter}
        />
      </AppShell>

      <NewEntryButton onClick={handleNewEntry} />

      <SearchPanel
        isOpen={searchOpen}
        query={query}
        results={results}
        onSearch={search}
        onClose={closeSearch}
        onResultClick={handleSearchResultClick}
      />
    </>
  );
}
