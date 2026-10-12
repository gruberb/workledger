import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AppShell } from "../components/layout/AppShell.tsx";
import { ErrorBoundary } from "../components/ui/ErrorBoundary.tsx";
import { Sidebar } from "../features/sidebar/index.ts";
import { useSidebarUI, useSidebarFilter, useSidebarData } from "../features/sidebar/index.ts";
import { EntryStream, ReviewStream, NewEntryButton, NewEntryIconButton, useEntriesData, useEntriesActions, type EntryActions, type EntryTemplate, type WorkLedgerEntry } from "../features/entries/index.ts";
import { EntryEditor } from "../features/editor/index.ts";
import { SearchPanel, useSearch } from "../features/search/index.ts";
import { useFocusModeContext } from "../features/focus-mode/index.ts";
import { useAIContext } from "../features/ai/index.ts";
import { LogseqImportInput } from "../features/logseq-import/index.ts";
import { useKeyboardShortcuts } from "../hooks/useKeyboardShortcuts.ts";
import { useIsMobile } from "../hooks/useIsMobile.ts";
import { scrollToEntry } from "../utils/scroll.ts";
import { useEntryNavigation } from "./hooks/useEntryNavigation.ts";
import { FilterBanner } from "./components/FilterBanner.tsx";
import { StorageStatusBanner } from "./components/StorageStatusBanner.tsx";
import { AppHeader, HeaderButton } from "./components/AppHeader.tsx";
import { AIIcon } from "../components/ui/Icons.tsx";

const AISidebar = lazy(() => import("../features/ai/sidebar.ts").then((m) => ({ default: m.AISidebar })));
import { AppProviders } from "./AppProviders.tsx";
import { SettingsMenuItems } from "./SettingsMenuItems.tsx";

// Loaded on first download, and composed here so the entries feature never imports the editor.
function downloadMarkdown(entry: WorkLedgerEntry) {
  import("../features/editor/markdown.ts")
    .then((m) => m.downloadEntryMarkdown(entry))
    .catch((err) => console.error("Markdown export failed", err));
}

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
  const { loading, error } = useEntriesData();
  const { createEntry, saveEntryContent, updateEntryTags, archiveEntry, unarchiveEntry, deleteEntry, pinEntry, unpinEntry, updateEntrySignifier, setLoadAll } = useEntriesActions();
  const { isOpen: sidebarOpen, toggleSidebar, archiveView, reviewView, reviewWeekKey, setReviewWeekKey } = useSidebarUI();
  const { textQuery, selectedTags, selectedSignifiers, hasActiveFilters, removeTag, clearAllFilters, saveCurrentFilter, savedFilters } = useSidebarFilter();
  const { isFiltering, displayEntriesByDay, displayArchivedEntriesByDay } = useSidebarData();
  const { focusedEntryId, handleFocusEntry, handleExitFocus } = useFocusModeContext();
  const { settings: aiSettings, sidebarOpen: aiSidebarOpen, handleOpenAI, handleToggleAISidebar, available: aiAvailable, setSidebarOpen: setAISidebarOpen } = useAIContext();
  const { query, results, isOpen: searchOpen, search, open: openSearch, close: closeSearch } = useSearch();
  const { handleNewEntry } = useKeyboardShortcuts({ isOpen: searchOpen, open: openSearch, close: closeSearch });

  const visibleEntriesByDay = archiveView ? displayArchivedEntriesByDay : displayEntriesByDay;
  const visibleDayKeys = useMemo(() => [...visibleEntriesByDay.keys()].join("|"), [visibleEntriesByDay]);
  const { revealEntry, handleDayClick } = useEntryNavigation(visibleDayKeys);

  // Filters only see in-memory entries; load all of them while filtering the main view.
  // Follows the applied (debounced) filter, not the input: loading everything
  // before the text filter applies would render the whole notebook unfiltered.
  useEffect(() => {
    setLoadAll(isFiltering && !archiveView);
  }, [isFiltering, archiveView, setLoadAll]);

  const aiActionsAvailable = aiSettings.enabled && aiAvailable && !isMobile;

  const actions = useMemo<EntryActions>(() => archiveView
    ? { onSave: saveEntryContent, onDelete: deleteEntry, onUnarchive: unarchiveEntry, onFocus: handleFocusEntry, onDownloadMarkdown: downloadMarkdown }
    : {
        onSave: saveEntryContent,
        onTagsChange: updateEntryTags,
        onArchive: archiveEntry,
        onDelete: deleteEntry,
        onPin: pinEntry,
        onUnpin: unpinEntry,
        onSignifierChange: updateEntrySignifier,
        onOpenAI: aiActionsAvailable ? handleOpenAI : undefined,
        onFocus: handleFocusEntry,
        onDownloadMarkdown: downloadMarkdown,
      },
  [archiveView, saveEntryContent, deleteEntry, unarchiveEntry, updateEntryTags, archiveEntry, pinEntry, unpinEntry, updateEntrySignifier, aiActionsAvailable, handleOpenAI, handleFocusEntry]);

  const visibleCount = useMemo(
    () => [...visibleEntriesByDay.values()].reduce((sum, entries) => sum + entries.length, 0),
    [visibleEntriesByDay],
  );

  const logseqInputRef = useRef<HTMLInputElement>(null);
  const handleImportLogseq = useCallback(() => logseqInputRef.current?.click(), []);

  const handleReviewOpenAI = useCallback(() => {
    setAISidebarOpen(true);
  }, [setAISidebarOpen]);

  // Small screens show previews, so a new entry opens full-screen instead of scrolling to a card.
  const [newEntryId, setNewEntryId] = useState<string | null>(null);
  const showCreated = useCallback((entry: WorkLedgerEntry) => {
    if (isMobile) {
      setNewEntryId(entry.id);
      handleFocusEntry(entry);
    } else {
      scrollToEntry(entry.id);
    }
  }, [isMobile, handleFocusEntry]);

  const handleNewEntryFromTemplate = useCallback(async (template: EntryTemplate) => {
    const entry = await createEntry({ blocks: template.blocks, tags: template.tag ? [template.tag] : [], signifier: template.signifier });
    showCreated(entry);
  }, [createEntry, showCreated]);

  const handleHeaderNewEntry = useCallback(async () => {
    showCreated(await createEntry());
  }, [createEntry, showCreated]);

  if (loading) {
    return (
      <>
        <StorageStatusBanner error={error} loaded={false} />
        <div className="min-h-screen bg-[var(--color-notebook-bg)] flex items-center justify-center">
          <div className="text-stone-400 dark:text-stone-500 text-sm">Loading notebook...</div>
        </div>
      </>
    );
  }

  const viewTitle = reviewView ? "Weekly review" : archiveView ? "Archive" : "Journal";
  // The full-screen entry has its own header (back, info, actions).
  const showHeader = !(isMobile && focusedEntryId);
  const canCreate = !archiveView && !reviewView;

  const filterBanner = hasActiveFilters ? (
    <FilterBanner
      selectedTags={selectedTags}
      selectedSignifiers={selectedSignifiers}
      textQuery={textQuery}
      count={visibleCount}
      onRemoveTag={removeTag}
      onClearAll={clearAllFilters}
      onSaveFilter={!archiveView ? saveCurrentFilter : undefined}
      savedFilters={!archiveView ? savedFilters : undefined}
    />
  ) : undefined;

  return (
    <>
      <StorageStatusBanner error={error} loaded />

      <Sidebar
        onDayClick={handleDayClick}
        onSearchOpen={openSearch}
        settingsItems={<SettingsMenuItems onImportLogseq={handleImportLogseq} />}
      />
      <LogseqImportInput inputRef={logseqInputRef} />

      <AppShell
        sidebarOpen={sidebarOpen}
        aiSidebarOpen={aiSidebarOpen}
        header={showHeader ? (
          <AppHeader
            title={viewTitle}
            showMenu={isMobile || !sidebarOpen}
            onMenu={toggleSidebar}
            onSearch={openSearch}
            actions={<>
              {isMobile && canCreate && (
                <NewEntryIconButton onClick={handleHeaderNewEntry} onCreateFromTemplate={handleNewEntryFromTemplate} />
              )}
              {/* The AI sidebar is desktop-only; its own header closes it. */}
              {!isMobile && aiSettings.enabled && !aiSidebarOpen && (
                <HeaderButton label="Open AI sidebar" title="Open AI sidebar (⌘⇧I)" onClick={handleToggleAISidebar}>
                  <AIIcon size={18} />
                </HeaderButton>
              )}
            </>}
          />
        ) : undefined}
      >
        {reviewView ? (
          <ReviewStream
            entriesByDay={displayEntriesByDay}
            weekKey={reviewWeekKey}
            onWeekChange={setReviewWeekKey}
            onEntryClick={revealEntry}
            onOpenAI={aiActionsAvailable ? handleReviewOpenAI : undefined}
          />
        ) : (
          <EntryStream
            entriesByDay={visibleEntriesByDay}
            actions={actions}
            Editor={EntryEditor}
            isArchiveView={archiveView}
            filterBanner={filterBanner}
            focusedEntryId={focusedEntryId}
            onExitFocus={handleExitFocus}
            preview={isMobile}
            autoFocusEntryId={newEntryId}
          />
        )}
      </AppShell>

      {!isMobile && canCreate && !focusedEntryId && <NewEntryButton onClick={handleNewEntry} onCreateFromTemplate={handleNewEntryFromTemplate} aiSidebarOpen={aiSidebarOpen} />}

      <SearchPanel
        isOpen={searchOpen}
        query={query}
        results={results}
        onSearch={search}
        onClose={closeSearch}
        onResultClick={revealEntry}
      />

      {aiSettings.enabled && (
        <ErrorBoundary fallback={
          <div className="fixed right-0 top-0 h-full w-96 bg-[var(--color-notebook-surface)] border-l border-[var(--color-notebook-border)] flex items-center justify-center">
            <p className="text-sm text-[var(--color-notebook-muted)]">AI unavailable</p>
          </div>
        }>
          <Suspense fallback={null}>
            <AISidebar />
          </Suspense>
        </ErrorBoundary>
      )}
    </>
  );
}
