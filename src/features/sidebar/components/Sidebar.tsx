import { useState, useRef, useCallback, useEffect, type ReactNode } from "react";
import { useIsMobile } from "../../../hooks/useIsMobile.ts";
import type { EntrySignifier } from "../../entries/index.ts";
import type { SavedFilter } from "../types/saved-filter.ts";
import { useSidebarUI, useSidebarFilter, useSidebarData } from "../context/SidebarContext.tsx";
import { useEntriesActions } from "../../entries/index.ts";
import { SidebarSettings } from "./SidebarSettings.tsx";
import { SidebarDayList } from "./SidebarDayList.tsx";
import { SidebarTagCloud } from "./SidebarTagCloud.tsx";
import { SavedFilterSection } from "./SavedFilters.tsx";
import { SignifierFilter } from "./SignifierFilter.tsx";
import { SidebarWeekList } from "./SidebarWeekList.tsx";
import { SidebarNav } from "./SidebarNav.tsx";
import { ImportExport } from "./ImportExport.tsx";

interface SidebarProps {
  onDayClick: (dayKey: string) => void;
  /** Settings menu items from other features (theme, AI, storage), composed by the app. */
  settingsItems?: ReactNode;
}

export function Sidebar({ onDayClick, settingsItems }: SidebarProps) {
  const isMobile = useIsMobile();
  const { isOpen, toggleSidebar, archiveView, reviewView, reviewWeekKey, setReviewWeekKey } = useSidebarUI();
  const { selectedTags, toggleTag, selectedSignifiers, toggleSignifier, savedFilters, saveCurrentFilter, applySavedFilter, deleteSavedFilter } = useSidebarFilter();
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
  const [tagsCollapsed, setTagsCollapsed] = useState(false);
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

  const handleWeekSelect = useCallback((weekKey: string) => {
    setReviewWeekKey(weekKey);
    closeOnMobile();
  }, [setReviewWeekKey, closeOnMobile]);

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
        inert={!isOpen}
        className={`
          notebook-sidebar fixed top-0 left-0 h-dvh ${isMobile ? "z-40" : "z-0"}
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
              <h1 className="text-2xl text-[var(--color-notebook-text)] sidebar-title-font leading-tight">WorkLedger</h1>
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

        {/* px-2 leaves room for the lists' -mx-2 rows, whose text lines up with the logo. */}
        <div className="flex-1 min-h-0 flex flex-col overflow-y-auto px-2 -mx-2">
        <SidebarNav onSelect={closeOnMobile} />

        {/* Day list or Week list */}
        {reviewView ? (
          <SidebarWeekList
            dayKeys={dayKeys}
            entriesByDay={entriesByDay}
            selectedWeekKey={reviewWeekKey}
            onSelect={handleWeekSelect}
          />
        ) : (
          <SidebarDayList
            dayKeys={dayKeys}
            entriesByDay={entriesByDay}
            isArchiveView={archiveView}
            onDayClick={handleDayClick}
          />
        )}

        {/* Bottom panel: Saved Filters + Tags */}
        {!archiveView && (
          <div className="shrink-0 mt-1">
            {/* Drag handle */}
            <div
              onMouseDown={handleDragStart}
              className="h-2 cursor-row-resize flex items-center justify-center group"
            >
              <div className="w-8 h-0.5 rounded-full bg-gray-200 dark:bg-gray-700 group-hover:bg-gray-400 dark:group-hover:bg-gray-500 transition-colors" />
            </div>
            <div
              className="border-t border-[var(--color-notebook-border)] pt-2 overflow-y-auto"
              style={{ maxHeight: `min(${bottomHeight}px, 35dvh)` }}
            >
              <SavedFilterSection
                onSave={saveCurrentFilter}
                savedFilters={savedFilters}
                onApply={handleApplyFilter}
                onDelete={deleteSavedFilter}
                collapsed={filtersCollapsed}
                onToggleCollapse={handleToggleFiltersCollapse}
                selectedTags={selectedTags}
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

        </div>

        <div className="shrink-0 pt-3 flex justify-start border-t border-[var(--color-notebook-border)] mt-3">
          <SidebarSettings fileInputRef={fileInputRef}>{settingsItems}</SidebarSettings>
        </div>

        {/* Import file input */}
        <ImportExport fileInputRef={fileInputRef} onRefresh={refresh} />
      </aside>

      {/* Import toast is rendered by ImportExport */}
    </>
  );
}
