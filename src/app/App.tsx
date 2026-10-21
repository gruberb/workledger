import { lazy, Suspense, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { AppShell } from "../components/layout/AppShell.tsx";
import { ErrorBoundary } from "../components/ui/ErrorBoundary.tsx";
import { Sidebar } from "../features/sidebar/index.ts";
import { useSidebarUI, useSidebarFilter, useSidebarData } from "../features/sidebar/index.ts";
import { EntryStream, ReviewStream, NewEntryButton, NewEntryIconButton, useEntriesData, useEntriesActions, type EntryActions, type EntryTemplate, type WorkLedgerEntry } from "../features/entries/index.ts";
import { SearchDialog } from "../features/search/index.ts";
import { useFocusModeContext } from "../features/focus-mode/index.ts";
import { useAIContext } from "../features/ai/index.ts";
import { LogseqImportInput } from "../features/logseq-import/index.ts";
import { useKeyboardShortcuts } from "../hooks/useKeyboardShortcuts.ts";
import { useIsMobile } from "../hooks/useIsMobile.ts";
import { scrollToEntry } from "../utils/scroll.ts";
import { useEntryNavigation } from "./hooks/useEntryNavigation.ts";
import { useEntryDownload } from "./hooks/useEntryDownload.ts";
import { StatusToast } from "../components/ui/StatusToast.tsx";
import { FilterBanner } from "./components/FilterBanner.tsx";
import { StorageStatusBanner } from "./components/StorageStatusBanner.tsx";
import { AppHeader, HeaderButton } from "./components/AppHeader.tsx";
import { ViewMenu } from "./components/ViewMenu.tsx";
import { PanelRightIcon } from "../components/ui/Icons.tsx";

// BlockNote, ProseMirror and Mantine are over 1.5 MB. The editor loads on its
// own chunk so the shell can paint first; mobile previews never need it until a
// note is opened full-screen.
const loadEditor = () => import("../features/editor/index.ts").then((m) => ({ default: m.EntryEditor }));
const EntryEditor = lazy(loadEditor);
// Desktop shows editors right away, so fetch the chunk in parallel with the
// entries load instead of after the first card renders.
if (!window.matchMedia("(max-width: 767px)").matches) void loadEditor();

const AISidebar = lazy(() => import("../features/ai/sidebar.ts").then((m) => ({ default: m.AISidebar })));
import { AppProviders } from "./AppProviders.tsx";
import { SettingsMenuItems } from "./SettingsMenuItems.tsx";

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
  const { selectedTags, selectedSignifiers, hasActiveFilters, removeTag, toggleSignifier, clearAllFilters, saveCurrentFilter, savedFilters } = useSidebarFilter();
  const { isFiltering, displayEntriesByDay, displayArchivedEntriesByDay } = useSidebarData();
  const { focusedEntryId, handleFocusEntry, handleExitFocus } = useFocusModeContext();
  useLayoutEffect(() => {
    if (!isMobile || !focusedEntryId) return;
    const root = document.getElementById("root");
    // BlockNote needs one page-level scroll container to track the iOS keyboard smoothly.
    root?.classList.add("bn-scroll-container");
    return () => root?.classList.remove("bn-scroll-container");
  }, [isMobile, focusedEntryId]);
  const { settings: aiSettings, sidebarOpen: aiSidebarOpen, targetEntry: aiTargetEntry, handleOpenAI, handleToggleAISidebar, available: aiAvailable, setSidebarOpen: setAISidebarOpen } = useAIContext();
  const [searchOpen, setSearchOpen] = useState(false);
  const openSearch = useCallback(() => setSearchOpen(true), []);
  const closeSearch = useCallback(() => setSearchOpen(false), []);
  const { handleNewEntry } = useKeyboardShortcuts({ isOpen: searchOpen, open: openSearch, close: closeSearch });

  const visibleEntriesByDay = archiveView ? displayArchivedEntriesByDay : displayEntriesByDay;
  const visibleDayKeys = useMemo(() => [...visibleEntriesByDay.keys()].join("|"), [visibleEntriesByDay]);
  const { revealEntry, handleDayClick } = useEntryNavigation(visibleDayKeys);

  // Filters only see in-memory entries; load all of them while filtering the main view.
  useEffect(() => {
    setLoadAll(isFiltering && !archiveView);
  }, [isFiltering, archiveView, setLoadAll]);

  const aiActionsAvailable = aiSettings.enabled && aiAvailable && !isMobile;

  const { handleDownload, status: downloadStatus } = useEntryDownload();
  const actions = useMemo<EntryActions>(() => archiveView
    ? { onSave: saveEntryContent, onDelete: deleteEntry, onUnarchive: unarchiveEntry, onFocus: handleFocusEntry, onDownload: handleDownload }
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
        onDownload: handleDownload,
      },
  [archiveView, saveEntryContent, deleteEntry, unarchiveEntry, updateEntryTags, archiveEntry, pinEntry, unpinEntry, updateEntrySignifier, aiActionsAvailable, handleOpenAI, handleFocusEntry, handleDownload]);

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

  // The full-screen entry has its own header (back, info, actions).
  const showHeader = !(isMobile && focusedEntryId);
  const canCreate = !archiveView && !reviewView;

  // Filters replace the view title in the header; the review and full-screen entry don't apply them.
  const filterBanner = hasActiveFilters && !reviewView && !focusedEntryId ? (
    <FilterBanner
      selectedTags={selectedTags}
      selectedSignifiers={selectedSignifiers}
      count={visibleCount}
      onRemoveTag={removeTag}
      onRemoveSignifier={toggleSignifier}
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
        settingsItems={<SettingsMenuItems onImportLogseq={handleImportLogseq} />}
      />
      <LogseqImportInput inputRef={logseqInputRef} />
      <StatusToast message={downloadStatus?.message ?? null} tone={downloadStatus?.tone} />

      <AppShell
        sidebarOpen={sidebarOpen}
        aiSidebarOpen={aiSidebarOpen}
        header={showHeader ? (
          <AppHeader
            title={filterBanner ?? <ViewMenu />}
            showMenu={isMobile || !sidebarOpen}
            onMenu={toggleSidebar}
            onSearch={openSearch}
            actions={<>
              {isMobile && canCreate && (
                <NewEntryIconButton onClick={handleHeaderNewEntry} onCreateFromTemplate={handleNewEntryFromTemplate} />
              )}
              {/* The AI sidebar is desktop-only. The button stays while it is open
                  (pressed), so the header buttons never jump. */}
              {!isMobile && aiSettings.enabled && (
                <HeaderButton
                  label={aiSidebarOpen ? "Close AI sidebar" : "Open AI sidebar"}
                  title={`${aiSidebarOpen ? "Close" : "Open"} AI sidebar (⌘⇧I)`}
                  pressed={aiSidebarOpen}
                  onClick={handleToggleAISidebar}
                >
                  <PanelRightIcon size={18} />
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
            isFiltering={hasActiveFilters}
            aiEntryId={aiSidebarOpen ? aiTargetEntry?.id : null}
            focusedEntryId={focusedEntryId}
            onExitFocus={handleExitFocus}
            preview={isMobile}
            autoFocusEntryId={newEntryId}
          />
        )}
      </AppShell>

      {!isMobile && canCreate && !focusedEntryId && <NewEntryButton onClick={handleNewEntry} onCreateFromTemplate={handleNewEntryFromTemplate} aiSidebarOpen={aiSidebarOpen} />}

      <SearchDialog isOpen={searchOpen} onClose={closeSearch} onResultClick={revealEntry} />

      {aiSettings.enabled && (
        <ErrorBoundary fallback={
          <div className="fixed right-0 top-0 h-full w-[var(--ai-sidebar-w)] bg-[var(--color-notebook-surface)] border-l border-[var(--color-notebook-border)] flex items-center justify-center">
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
