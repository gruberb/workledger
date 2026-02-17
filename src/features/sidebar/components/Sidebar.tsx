import { useState, useRef, useEffect, useCallback } from "react";
import { useIsMobile } from "../../../hooks/useIsMobile.ts";
import { useSidebarUI, useSidebarFilter, useSidebarData } from "../context/SidebarContext.tsx";
import { useThemeContext } from "../../theme/index.ts";
import { useAIContext } from "../../ai/index.ts";
import { useEntriesActions } from "../../entries/index.ts";
import { SidebarSettings } from "./SidebarSettings.tsx";
import { SidebarDayList } from "./SidebarDayList.tsx";
import { SidebarTagCloud } from "./SidebarTagCloud.tsx";
import { SavedFilterSection, SaveFilterButton } from "./SavedFilters.tsx";
import { SignifierFilter } from "./SignifierFilter.tsx";
import { ImportExport } from "./ImportExport.tsx";

interface SidebarProps {
  onDayClick: (dayKey: string) => void;
  onSearchOpen: () => void;
}

export function Sidebar({ onDayClick, onSearchOpen }: SidebarProps) {
  const isMobile = useIsMobile();
  const { isOpen, toggleSidebar, archiveView, toggleArchiveView, activeDayKey } = useSidebarUI();
  const { textQuery, setTextQuery, selectedTags, toggleTag, hasActiveFilters, selectedSignifiers, toggleSignifier, savedFilters, saveCurrentFilter, applySavedFilter, deleteSavedFilter, clearAllFilters } = useSidebarFilter();
  const {
    displayEntriesByDay,
    displayArchivedEntriesByDay,
    sidebarDayKeys,
    archivedDayKeys,
    allTags,
    allSignifiers,
    archivedCount,
    handleDeleteAll,
  } = useSidebarData();
  const { themeId, setTheme, fontFamily, setFont } = useThemeContext();
  const { settings: aiSettings, handleToggleAI } = useAIContext();
  const { refresh } = useEntriesActions();

  const dayKeys = archiveView ? archivedDayKeys : sidebarDayKeys;
  const entriesByDay = archiveView ? (displayArchivedEntriesByDay as Map<string, unknown[]>) : (displayEntriesByDay as Map<string, unknown[]>);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const settingsRef = useRef<HTMLDivElement>(null);

  // Bottom panel resize
  const [bottomHeight, setBottomHeight] = useState(160);
  const [filtersCollapsed, setFiltersCollapsed] = useState(false);
  const [signifiersCollapsed, setSignifiersCollapsed] = useState(false);
  const [tagsCollapsed, setTagsCollapsed] = useState(true);
  const dragRef = useRef<{ startY: number; startHeight: number } | null>(null);
  const handleDragStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    dragRef.current = { startY: e.clientY, startHeight: bottomHeight };
    const onMove = (ev: MouseEvent) => {
      if (!dragRef.current) return;
      const delta = dragRef.current.startY - ev.clientY;
      setBottomHeight(Math.max(110, Math.min(500, dragRef.current.startHeight + delta)));
    };
    const onUp = () => {
      dragRef.current = null;
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
    };
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  }, [bottomHeight]);

  // Close settings dropdown when clicking outside
  useEffect(() => {
    if (!settingsOpen) return;
    function handleClick(e: MouseEvent) {
      if (settingsRef.current && !settingsRef.current.contains(e.target as Node)) {
        setSettingsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [settingsOpen]);

  return (
    <>
      {/* Toggle button — only visible when sidebar is closed */}
      {!isOpen && (
        <button
          onClick={toggleSidebar}
          className={`fixed top-4 left-4 ${isMobile ? "z-50" : "z-10"} p-2 rounded-lg bg-[var(--color-notebook-surface)]/80 hover:bg-[var(--color-notebook-surface)] border border-[var(--color-notebook-border)] shadow-sm transition-all duration-300 text-[var(--color-notebook-muted)] hover:text-[var(--color-notebook-text)]`}
          title="Expand sidebar (⌘\)"
          aria-label="Expand sidebar"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="9 18 15 12 9 6" />
          </svg>
        </button>
      )}

      {/* Mobile backdrop */}
      {isMobile && isOpen && (
        <div className="fixed inset-0 z-30 bg-black/40 transition-opacity duration-300" onClick={toggleSidebar} />
      )}

      {/* Sidebar panel */}
      <aside
        className={`
          fixed top-0 left-0 h-full ${isMobile ? "z-40" : "z-0"}
          bg-[var(--color-notebook-surface)] border-r border-[var(--color-notebook-border)]
          shadow-[1px_0_12px_rgba(0,0,0,0.03)] dark:shadow-[1px_0_12px_rgba(0,0,0,0.3)]
          transition-transform duration-300 ease-in-out
          ${isMobile ? "w-full" : "w-80"} pt-[23px] pb-5 px-[22px]
          flex flex-col
          ${isOpen ? "translate-x-0" : "-translate-x-full"}
        `}
      >
        {/* Header */}
        <div className="mb-6 flex items-center gap-3 shrink-0">
          <a href="https://about.workledger.org" target="_blank" rel="noopener" className="flex items-center gap-3 flex-1 min-w-0">
            <img src="/logo.svg" alt="WorkLedger" className="w-9 h-9 shrink-0" />
            <div className="flex-1 min-w-0">
              <h1 className="text-3xl text-[var(--color-notebook-text)] sidebar-title-font leading-tight">WorkLedger</h1>
              <p className="text-xs text-[var(--color-notebook-muted)] -mt-0.5">Engineering Notebook</p>
            </div>
          </a>
          <button
            onClick={toggleSidebar}
            className="p-1.5 rounded-lg hover:bg-[var(--color-notebook-surface-alt)] text-[var(--color-notebook-muted)] hover:text-[var(--color-notebook-text)] transition-colors shrink-0"
            title="Collapse sidebar (⌘\)"
            aria-label="Collapse sidebar"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 18 9 12 15 6" />
            </svg>
          </button>
        </div>

        {/* Filter */}
        <div className="mb-5 shrink-0">
          <div className="relative">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none">
              <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <input
              type="text"
              value={textQuery}
              onChange={(e) => setTextQuery(e.target.value)}
              placeholder={archiveView ? "Filter archive..." : "Filter entries..."}
              className={`w-full text-sm bg-[var(--color-notebook-surface-alt)] border border-[var(--color-notebook-border)] rounded-lg pl-8 ${hasActiveFilters ? "pr-16" : "pr-3"} py-2 outline-none focus:bg-[var(--color-notebook-surface)] transition-all text-[var(--color-notebook-text)] placeholder:text-[var(--color-notebook-muted)] sidebar-filter-input`}
              autoComplete="off"
              data-1p-ignore
            />
            <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
              {hasActiveFilters && !archiveView && (
                <SaveFilterButton
                  variant="icon"
                  onSave={saveCurrentFilter}
                  savedFilters={savedFilters}
                  selectedTags={selectedTags}
                  textQuery={textQuery}
                />
              )}
              {hasActiveFilters && (
                <button onClick={clearAllFilters} className="text-gray-400 hover:text-gray-600" aria-label="Clear all filters">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                    <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>
              )}
            </div>
          </div>
          <div className="flex items-center justify-between mt-2 px-2">
            {archiveView ? (
              <p className="text-[11px] uppercase tracking-wider text-amber-500 font-medium flex items-center gap-2">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="21 8 21 21 3 21 3 8" /><rect x="1" y="3" width="22" height="5" /><line x1="10" y1="12" x2="14" y2="12" />
                </svg>
                Archive
              </p>
            ) : (
              <button onClick={() => { onSearchOpen(); if (isMobile) toggleSidebar(); }} className="text-sm text-[var(--color-notebook-muted)] hover:text-[var(--color-notebook-text)] transition-colors">
                Full search <kbd className="px-1.5 py-0.5 bg-[var(--color-notebook-surface-alt)] rounded text-[10px]">⌘K</kbd>
              </button>
            )}
            <SidebarSettings
              settingsOpen={settingsOpen}
              setSettingsOpen={setSettingsOpen}
              settingsRef={settingsRef}
              isArchiveView={archiveView}
              onToggleArchiveView={toggleArchiveView}
              archivedCount={archivedCount}
              onToggleAI={handleToggleAI}
              aiEnabled={aiSettings.enabled}
              fileInputRef={fileInputRef}
              onDeleteAll={handleDeleteAll}
              themeId={themeId}
              onSetTheme={setTheme}
              fontFamily={fontFamily}
              onSetFont={setFont}
            />
          </div>
        </div>

        {/* Day list */}
        <SidebarDayList
          dayKeys={dayKeys}
          entriesByDay={entriesByDay}
          isArchiveView={archiveView}
          activeDayKey={activeDayKey}
          onDayClick={(dayKey: string) => {
            onDayClick(dayKey);
            if (isMobile) toggleSidebar();
          }}
        />

        {/* Bottom panel: Saved Filters + Tags */}
        {!archiveView && (allTags.length > 0 || savedFilters.length > 0 || allSignifiers.length > 0) && (
          <div className="shrink-0 mt-1">
            {/* Drag handle */}
            <div
              onMouseDown={handleDragStart}
              className="h-2 cursor-row-resize flex items-center justify-center group"
            >
              <div className="w-8 h-0.5 rounded-full bg-gray-200 dark:bg-gray-700 group-hover:bg-gray-400 dark:group-hover:bg-gray-500 transition-colors" />
            </div>
            <div
              className="border-t border-gray-100 dark:border-gray-800 pt-2 overflow-y-auto"
              style={{ maxHeight: bottomHeight }}
            >
              <SavedFilterSection
                savedFilters={savedFilters}
                onApply={(f) => { applySavedFilter(f); if (isMobile) toggleSidebar(); }}
                onDelete={deleteSavedFilter}
                collapsed={filtersCollapsed}
                onToggleCollapse={() => setFiltersCollapsed((p) => !p)}
                selectedTags={selectedTags}
                textQuery={textQuery}
              />
              <SignifierFilter
                allSignifiers={allSignifiers}
                selectedSignifiers={selectedSignifiers}
                onToggle={(s) => { toggleSignifier(s); if (isMobile) toggleSidebar(); }}
                collapsed={signifiersCollapsed}
                onToggleCollapse={() => setSignifiersCollapsed((p) => !p)}
              />
              <SidebarTagCloud
                allTags={allTags}
                selectedTags={selectedTags}
                onToggleTag={(t) => { toggleTag(t); if (isMobile) toggleSidebar(); }}
                collapsed={tagsCollapsed}
                onToggleCollapse={() => setTagsCollapsed((p) => !p)}
              />
            </div>
          </div>
        )}

        {/* Import file input */}
        <ImportExport fileInputRef={fileInputRef} onRefresh={refresh} />
      </aside>

      {/* Import toast is rendered by ImportExport */}
    </>
  );
}
