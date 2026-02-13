import { lazy, Suspense } from "react";
import { AppShell } from "../components/layout/AppShell.tsx";
import { Sidebar } from "../features/sidebar/components/Sidebar.tsx";
import { EntryStream } from "../features/entries/components/EntryStream.tsx";
import { NewEntryButton } from "../features/entries/components/NewEntryButton.tsx";
import { SearchPanel } from "../features/search/components/SearchPanel.tsx";
import { useEntriesData, useEntriesActions } from "../features/entries/context/EntriesContext.tsx";

const AISidebar = lazy(() => import("../features/ai/components/AISidebar.tsx").then((m) => ({ default: m.AISidebar })));
import { useSidebarContext } from "../features/sidebar/context/SidebarContext.tsx";
import { useFocusModeContext } from "../features/focus-mode/context/FocusModeContext.tsx";
import { useAIContext } from "../features/ai/context/AIContext.tsx";
import { useSearch } from "../features/search/hooks/useSearch.ts";
import { useKeyboardShortcuts } from "../hooks/useKeyboardShortcuts.ts";
import { useEntryNavigation } from "../features/entries/hooks/useEntryNavigation.ts";
import { useTheme } from "../features/theme/hooks/useTheme.ts";
import { AppProviders } from "./AppProviders.tsx";

export default function App() {
  return (
    <AppProviders>
      <AppContent />
    </AppProviders>
  );
}

function AppContent() {
  const { loading } = useEntriesData();
  const { updateEntry, updateEntryTags, archiveEntry, unarchiveEntry, deleteEntry } = useEntriesActions();
  const {
    isOpen: sidebarOpen,
    archiveView,
    filter: sidebarFilter,
    setFilter: setSidebarFilter,
    clearFilter,
    displayEntriesByDay,
    displayArchivedEntriesByDay,
    sidebarDayKeys,
    archivedDayKeys,
    allTags,
    archivedCount,
    toggleArchiveView,
    activeDayKey,
    handleDeleteAll,
    toggleSidebar,
  } = useSidebarContext();
  const { focusedEntryId, handleFocusEntry, handleExitFocus } = useFocusModeContext();
  const { settings: aiSettings, sidebarOpen: aiSidebarOpen, targetEntry: aiTargetEntry, handleToggleAI, handleToggleAISidebar, handleOpenAI, available: aiAvailable, updateSettings: updateAISettings } = useAIContext();
  const { query, results, isOpen: searchOpen, search, close: closeSearch } = useSearch();
  const { handleNewEntry } = useKeyboardShortcuts();
  const { handleSearchResultClick, handleDayClick } = useEntryNavigation();

  const { resolved: themeMode, toggle: toggleTheme } = useTheme();

  if (loading) {
    return (
      <div className="min-h-screen bg-[var(--color-notebook-bg)] flex items-center justify-center">
        <div className="text-stone-400 dark:text-stone-500 text-sm">Loading notebook...</div>
      </div>
    );
  }

  const handleTagsChange = (entryId: string, dayKey: string, tags: string[]) => {
    updateEntryTags(entryId, dayKey, tags);
  };

  return (
    <>
      <Sidebar
        dayKeys={archiveView ? archivedDayKeys : sidebarDayKeys}
        entriesByDay={archiveView ? (displayArchivedEntriesByDay as Map<string, unknown[]>) : (displayEntriesByDay as Map<string, unknown[]>)}
        isOpen={sidebarOpen}
        onToggle={toggleSidebar}
        onDayClick={handleDayClick}
        sidebarSearchQuery={sidebarFilter}
        onSidebarSearch={setSidebarFilter}
        onSearchOpen={() => search("")}
        allTags={allTags}
        onTagClick={(tag) => setSidebarFilter(tag)}
        onRefresh={() => {}}
        isArchiveView={archiveView}
        onToggleArchiveView={toggleArchiveView}
        archivedCount={archivedCount}
        activeDayKey={activeDayKey}
        onDeleteAll={handleDeleteAll}
        aiEnabled={aiSettings.enabled}
        onToggleAI={handleToggleAI}
        themeMode={themeMode}
        onToggleTheme={toggleTheme}
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
          focusedEntryId={focusedEntryId}
          onFocusEntry={handleFocusEntry}
          onExitFocus={handleExitFocus}
        />
      </AppShell>

      {!archiveView && !focusedEntryId && <NewEntryButton onClick={handleNewEntry} />}

      <SearchPanel
        isOpen={searchOpen}
        query={query}
        results={results}
        onSearch={search}
        onClose={closeSearch}
        onResultClick={handleSearchResultClick}
      />

      {aiSettings.enabled && (
        <Suspense fallback={null}>
          <AISidebar
            isOpen={aiSidebarOpen}
            onClose={handleToggleAISidebar}
            settings={aiSettings}
            onUpdateSettings={updateAISettings}
            targetEntry={aiTargetEntry}
          />
        </Suspense>
      )}
    </>
  );
}
