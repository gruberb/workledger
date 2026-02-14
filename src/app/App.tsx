import { lazy, Suspense } from "react";
import { AppShell } from "../components/layout/AppShell.tsx";
import { Sidebar, useSidebarContext } from "../features/sidebar/index.ts";
import { EntryStream, NewEntryButton, useEntriesData, useEntriesActions, useEntryNavigation } from "../features/entries/index.ts";
import { SearchPanel, useSearch } from "../features/search/index.ts";
import { useFocusModeContext } from "../features/focus-mode/index.ts";
import { useAIContext } from "../features/ai/index.ts";
import { useThemeContext } from "../features/theme/index.ts";
import { useKeyboardShortcuts } from "../hooks/useKeyboardShortcuts.ts";

const AISidebar = lazy(() => import("../features/ai/index.ts").then((m) => ({ default: m.AISidebar })));
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
  const { updateEntry, updateEntryTags, archiveEntry, unarchiveEntry, deleteEntry, refresh } = useEntriesActions();
  const {
    isOpen: sidebarOpen,
    archiveView,
    selectedTags,
    toggleTag,
    removeTag,
    textQuery,
    setTextQuery,
    clearAllFilters,
    hasActiveFilters,
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
  const { query, results, isOpen: searchOpen, search, open: openSearch, close: closeSearch } = useSearch();
  const { handleNewEntry } = useKeyboardShortcuts({ isOpen: searchOpen, open: openSearch, close: closeSearch });
  const { handleSearchResultClick, handleDayClick } = useEntryNavigation();

  const { themeId, setTheme, fontFamily, setFont } = useThemeContext();

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
        textQuery={textQuery}
        onTextSearch={setTextQuery}
        onSearchOpen={() => search("")}
        allTags={allTags}
        selectedTags={selectedTags}
        onToggleTag={toggleTag}
        onRefresh={refresh}
        isArchiveView={archiveView}
        onToggleArchiveView={toggleArchiveView}
        archivedCount={archivedCount}
        activeDayKey={activeDayKey}
        onDeleteAll={handleDeleteAll}
        aiEnabled={aiSettings.enabled}
        onToggleAI={handleToggleAI}
        themeId={themeId}
        onSetTheme={setTheme}
        fontFamily={fontFamily}
        onSetFont={setFont}
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
          textQuery={textQuery}
          selectedTags={selectedTags}
          hasActiveFilters={hasActiveFilters}
          onRemoveTag={removeTag}
          onClearAllFilters={clearAllFilters}
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
