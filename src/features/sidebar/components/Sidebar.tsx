import { useState, useRef, useCallback, useEffect, type ReactNode } from "react";
import { useIsMobile } from "../../../hooks/useIsMobile.ts";
import { useResizablePanel } from "../../../hooks/useResizablePanel.ts";
import { ResizeHandle } from "../../../components/ui/ResizeHandle.tsx";
import type { EntrySignifier, WorkLedgerEntry } from "../../entries/index.ts";
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

const WIDTH_LIMITS = { min: 240, max: 480, collapseBelow: 180 };

interface SidebarProps {
  onDayClick: (dayKey: string) => void;
  /** Jumps to an entry, from the titles listed under a day. */
  onEntryClick: (entryId: string) => void;
  /** Settings menu items from other features (theme, AI, storage), composed by the app. */
  settingsItems?: ReactNode;
}

export function Sidebar({ onDayClick, onEntryClick, settingsItems }: SidebarProps) {
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
  const resize = useResizablePanel({
    cssVar: "--sidebar-w",
    storageKey: "workledger-sidebar-width",
    defaultWidth: 320,
    side: "left",
    ...WIDTH_LIMITS,
    onCollapse: toggleSidebar,
  });

  const dayKeys = archiveView ? archivedDayKeys : sidebarDayKeys;
  const entriesByDay: Map<string, WorkLedgerEntry[]> = archiveView ? displayArchivedEntriesByDay : displayEntriesByDay;

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Bottom panel resize
  const [bottomHeight, setBottomHeight] = useState(240);
  // Collapsed until opened, so the day list keeps the room.
  const [filtersCollapsed, setFiltersCollapsed] = useState(true);
  const [signifiersCollapsed, setSignifiersCollapsed] = useState(true);
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

  const handleEntryClick = useCallback((entryId: string) => {
    onEntryClick(entryId);
    closeOnMobile();
  }, [onEntryClick, closeOnMobile]);

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
          bg-[var(--color-notebook-bg)] border-r-[1.5px] border-[var(--color-notebook-frame)]
          transition-transform duration-300 ease-in-out
          ${isMobile ? "w-[85%] max-w-sm" : "w-[var(--sidebar-w)]"} pt-[23px] pb-5 px-[22px]
          flex flex-col
          ${resize.collapsing ? "opacity-50" : ""}
          ${isOpen ? "translate-x-0" : "-translate-x-full"}
        `}
      >
        {!isMobile && (
          <ResizeHandle
            edge="right"
            label="Resize sidebar"
            width={resize.width}
            min={WIDTH_LIMITS.min}
            max={WIDTH_LIMITS.max}
            onPointerDown={resize.handlePointerDown}
            onKeyDown={resize.handleKeyDown}
          />
        )}

        {/* Header */}
        <div className="mb-6 flex items-center gap-3 shrink-0">
          <a href="https://about.workledger.org" target="_blank" rel="noopener" className="flex items-center gap-3 flex-1 min-w-0">
            <img src="/logo.svg" alt="WorkLedger" className="w-9 h-9 shrink-0" />
            <div className="flex-1 min-w-0">
              {/* No wrapping: the sidebar can be dragged narrow. */}
              <h1 className="text-2xl text-[var(--color-notebook-text)] sidebar-title-font leading-tight truncate">WorkLedger</h1>
              <p className="text-xs text-[var(--color-notebook-muted)] -mt-0.5 truncate">Engineering Notebook</p>
            </div>
          </a>
          {/* Desktop toggles from the header button; the mobile drawer covers it. */}
          {isMobile && (
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
          )}
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
            onEntryClick={handleEntryClick}
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
              <div className="w-10 h-1 rounded-full bg-[var(--color-notebook-border)] group-hover:bg-[var(--color-notebook-muted)]" />
            </div>
            <div
              className="border-t border-[var(--color-notebook-ruling)] pt-2 overflow-y-auto"
              style={{ maxHeight: `min(${bottomHeight}px, 45dvh)` }}
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
