import { lazy, Suspense } from "react";
import { AppShell } from "../components/layout/AppShell.tsx";
import { ErrorBoundary } from "../components/ui/ErrorBoundary.tsx";
import { Sidebar } from "../features/sidebar/index.ts";
import { useSidebarUI, useSidebarFilter, useSidebarData } from "../features/sidebar/index.ts";
import { EntryStream, ReviewStream, NewEntryButton, useEntriesData, useEntriesActions, useEntryNavigation, type EntryTemplate } from "../features/entries/index.ts";
import { SearchPanel, useSearch } from "../features/search/index.ts";
import { useFocusModeContext } from "../features/focus-mode/index.ts";
import { useAIContext } from "../features/ai/index.ts";
import { useKeyboardShortcuts } from "../hooks/useKeyboardShortcuts.ts";
import { useIsMobile } from "../hooks/useIsMobile.ts";
import { emit } from "../utils/events.ts";

const AISidebar = lazy(() => import("../features/ai/index.ts").then((m) => ({ default: m.AISidebar })));
import { AppProviders } from "./AppProviders.tsx";

export default function App() {
  return (
    <AppProviders>
      <ErrorBoundary>
        <AppContent />
      </ErrorBoundary>
    </AppProviders>
  );
}

function AppContent() {
  const isMobile = useIsMobile();
  const { loading } = useEntriesData();
  const { createEntry, updateEntry, updateEntryTags, archiveEntry, unarchiveEntry, deleteEntry, pinEntry, unpinEntry, updateEntrySignifier } = useEntriesActions();
  const { isOpen: sidebarOpen, archiveView, reviewView, toggleReviewView } = useSidebarUI();
  const { textQuery, selectedTags, hasActiveFilters, removeTag, clearAllFilters, saveCurrentFilter, savedFilters } = useSidebarFilter();
  const { displayEntriesByDay, displayArchivedEntriesByDay } = useSidebarData();
  const { focusedEntryId, handleFocusEntry, handleExitFocus } = useFocusModeContext();
  const { settings: aiSettings, sidebarOpen: aiSidebarOpen, targetEntry: aiTargetEntry, handleToggleAISidebar, handleOpenAI, available: aiAvailable, updateSettings: updateAISettings, setSidebarOpen: setAISidebarOpen } = useAIContext();
  const { query, results, isOpen: searchOpen, search, open: openSearch, close: closeSearch } = useSearch();
  const { handleNewEntry } = useKeyboardShortcuts({ isOpen: searchOpen, open: openSearch, close: closeSearch });
  const { handleSearchResultClick, handleDayClick } = useEntryNavigation();

  const handleReviewEntryClick = (entryId: string) => {
    toggleReviewView();
    setTimeout(() => {
      emit("navigate-entry", { entryId });
    }, 250);
  };

  const handleReviewOpenAI = () => {
    setAISidebarOpen(true);
  };

  const handleNewEntryFromTemplate = async (template: EntryTemplate) => {
    const entry = await createEntry({ blocks: template.blocks, tags: [template.tag] });
    setTimeout(() => {
      document.getElementById(`entry-${entry.id}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 100);
  };

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
        onDayClick={handleDayClick}
        onSearchOpen={() => search("")}
      />

      <AppShell sidebarOpen={sidebarOpen} aiSidebarOpen={aiSidebarOpen}>
        {reviewView ? (
          <ReviewStream
            entriesByDay={displayEntriesByDay}
            onEntryClick={handleReviewEntryClick}
            onOpenAI={aiSettings.enabled && aiAvailable && !isMobile ? handleReviewOpenAI : undefined}
          />
        ) : (
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
          onSaveFilter={!archiveView ? saveCurrentFilter : undefined}
          savedFilters={!archiveView ? savedFilters : undefined}
          onPin={archiveView ? undefined : pinEntry}
          onUnpin={archiveView ? undefined : unpinEntry}
          onSignifierChange={archiveView ? undefined : updateEntrySignifier}
          onOpenAI={aiSettings.enabled && aiAvailable && !isMobile ? handleOpenAI : undefined}
          focusedEntryId={focusedEntryId}
          onFocusEntry={handleFocusEntry}
          onExitFocus={handleExitFocus}
        />
        )}
      </AppShell>

      {!archiveView && !reviewView && !focusedEntryId && <NewEntryButton onClick={handleNewEntry} onCreateFromTemplate={handleNewEntryFromTemplate} aiSidebarOpen={aiSidebarOpen && !isMobile} />}

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
