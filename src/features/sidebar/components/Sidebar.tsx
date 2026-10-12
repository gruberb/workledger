import { useState, useRef, useCallback, useEffect, type ReactNode } from "react";
import { useIsMobile } from "../../../hooks/useIsMobile.ts";
import type { EntrySignifier } from "../../entries/index.ts";
import type { SavedFilter } from "../types/saved-filter.ts";
import { useSidebarUI, useSidebarFilter, useSidebarData } from "../context/SidebarContext.tsx";
import { useEntriesActions } from "../../entries/index.ts";
import { SidebarSettings } from "./SidebarSettings.tsx";
import { SidebarDayList } from "./SidebarDayList.tsx";
import { SidebarTagCloud } from "./SidebarTagCloud.tsx";
import { SavedFilterSection, SaveFilterButton } from "./SavedFilters.tsx";
import { SignifierFilter } from "./SignifierFilter.tsx";
import { SidebarWeekList } from "./SidebarWeekList.tsx";
import { SidebarNav } from "./SidebarNav.tsx";
import { ImportExport } from "./ImportExport.tsx";

interface SidebarProps {
  onDayClick: (dayKey: string) => void;
  onSearchOpen: () => void;
  /** Settings menu items from other features (theme, AI, storage), composed by the app. */
  settingsItems?: ReactNode;
}

export function Sidebar({ onDayClick, onSearchOpen, settingsItems }: SidebarProps) {
  const isMobile = useIsMobile();
  const { isOpen, toggleSidebar, archiveView, reviewView, activeDayKey } = useSidebarUI();
  const { textQuery, setTextQuery, selectedTags, toggleTag, hasActiveFilters, selectedSignifiers, toggleSignifier, savedFilters, saveCurrentFilter, applySavedFilter, deleteSavedFilter, clearAllFilters } = useSidebarFilter();
  const {
    displayEntriesByDay,
    displayArchivedEntriesByDay,
    sidebarDayKeys,
    archivedDayKeys,
    allTags,
    allSignifiers,
  } = useSidebarData();
  const { refresh } = useEntriesActions();

  const dayKeys = archiveView ? archivedDayKeys : sidebarDayKeys;
  const entriesByDay = archiveView ? (displayArchivedEntriesByDay as Map<string, unknown[]>) : (displayEntriesByDay as Map<string, unknown[]>);

  const fileInputRef = useRef<HTMLInputElement>(null);

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

  const closeOnMobile = useCallback(() => {
    if (isMobile) toggleSidebar();
  }, [isMobile, toggleSidebar]);

  const handleDayClick = useCallback((dayKey: string) => {
    onDayClick(dayKey);
    closeOnMobile();
  }, [onDayClick, closeOnMobile]);

  const handleApplyFilter = useCallback((f: SavedFilter) => {
    applySavedFilter(f);
    closeOnMobile();
  }, [applySavedFilter, closeOnMobile]);

  const handleToggleSignifier = useCallback((s: EntrySignifier) => {
    toggleSignifier(s);
    closeOnMobile();
  }, [toggleSignifier, closeOnMobile]);

  const handleToggleTag = useCallback((t: string) => {
    toggleTag(t);
    closeOnMobile();
  }, [toggleTag, closeOnMobile]);

  // Lock body scroll when mobile sidebar is open
  useEffect(() => {
    if (isMobile && isOpen) {
      document.body.style.overflow = "hidden";
      return () => { document.body.style.overflow = ""; };
    }
  }, [isMobile, isOpen]);

  const handleToggleFiltersCollapse = useCallback(() => setFiltersCollapsed((p) => !p), []);
  const handleToggleSignifiersCollapse = useCallback(() => setSignifiersCollapsed((p) => !p), []);
  const handleToggleTagsCollapse = useCallback(() => setTagsCollapsed((p) => !p), []);

  return (
    <>
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
          ${isMobile ? "w-[85%] max-w-sm" : "w-80"} pt-[23px] pb-5 px-[22px]
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

        <SidebarNav onSearch={onSearchOpen} onSelect={closeOnMobile} />

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
              placeholder={archiveView ? "Filter archive..." : reviewView ? "Filter review..." : "Filter entries..."}
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
                  selectedSignifiers={selectedSignifiers}
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
        </div>

        {/* Day list or Week list */}
        {reviewView ? (
          <SidebarWeekList
            dayKeys={dayKeys}
            entriesByDay={entriesByDay}
          />
        ) : (
          <SidebarDayList
            dayKeys={dayKeys}
            entriesByDay={entriesByDay}
            isArchiveView={archiveView}
            activeDayKey={activeDayKey}
            onDayClick={handleDayClick}
          />
        )}

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
                onApply={handleApplyFilter}
                onDelete={deleteSavedFilter}
                collapsed={filtersCollapsed}
                onToggleCollapse={handleToggleFiltersCollapse}
                selectedTags={selectedTags}
                textQuery={textQuery}
                selectedSignifiers={selectedSignifiers}
              />
              <SignifierFilter
                allSignifiers={allSignifiers}
                selectedSignifiers={selectedSignifiers}
                onToggle={handleToggleSignifier}
                collapsed={signifiersCollapsed}
                onToggleCollapse={handleToggleSignifiersCollapse}
              />
              <SidebarTagCloud
                allTags={allTags}
                selectedTags={selectedTags}
                onToggleTag={handleToggleTag}
                collapsed={tagsCollapsed}
                onToggleCollapse={handleToggleTagsCollapse}
              />
            </div>
          </div>
        )}

        <div className="shrink-0 pt-3 flex justify-end">
          <SidebarSettings fileInputRef={fileInputRef}>{settingsItems}</SidebarSettings>
        </div>

        {/* Import file input */}
        <ImportExport fileInputRef={fileInputRef} onRefresh={refresh} />
      </aside>

      {/* Import toast is rendered by ImportExport */}
    </>
  );
}
