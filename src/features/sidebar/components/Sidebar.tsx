import { useState, useRef, useEffect } from "react";
import { useIsMobile } from "../../../hooks/useIsMobile.ts";
import { SidebarSettings } from "./SidebarSettings.tsx";
import { SidebarDayList } from "./SidebarDayList.tsx";
import { SidebarTagCloud } from "./SidebarTagCloud.tsx";
import { ImportExport } from "./ImportExport.tsx";
import type { ThemeId, FontFamily } from "../../theme/index.ts";

interface SidebarProps {
  dayKeys: string[];
  entriesByDay: Map<string, unknown[]>;
  isOpen: boolean;
  onToggle: () => void;
  onDayClick: (dayKey: string) => void;
  textQuery: string;
  onTextSearch: (query: string) => void;
  onSearchOpen: () => void;
  allTags: string[];
  selectedTags: string[];
  onToggleTag: (tag: string) => void;
  onRefresh: () => void;
  isArchiveView: boolean;
  onToggleArchiveView: () => void;
  archivedCount: number;
  activeDayKey?: string | null;
  onDeleteAll?: () => void;
  aiEnabled?: boolean;
  onToggleAI?: () => void;
  themeId: ThemeId;
  onSetTheme: (id: ThemeId) => void;
  fontFamily: FontFamily;
  onSetFont: (f: FontFamily) => void;
}

export function Sidebar({
  dayKeys,
  entriesByDay,
  isOpen,
  onToggle,
  onDayClick,
  textQuery,
  onTextSearch,
  onSearchOpen,
  allTags,
  selectedTags,
  onToggleTag,
  onRefresh,
  isArchiveView,
  onToggleArchiveView,
  archivedCount,
  activeDayKey,
  onDeleteAll,
  aiEnabled,
  onToggleAI,
  themeId,
  onSetTheme,
  fontFamily,
  onSetFont,
}: SidebarProps) {
  const isMobile = useIsMobile();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const settingsRef = useRef<HTMLDivElement>(null);

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
          onClick={onToggle}
          className="fixed top-4 left-4 z-50 p-2 rounded-lg bg-[var(--color-notebook-surface)]/80 hover:bg-[var(--color-notebook-surface)] border border-[var(--color-notebook-border)] shadow-sm transition-all duration-300 text-[var(--color-notebook-muted)] hover:text-[var(--color-notebook-text)]"
          title="Expand sidebar (⌘\)"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="9 18 15 12 9 6" />
          </svg>
        </button>
      )}

      {/* Mobile backdrop */}
      {isMobile && isOpen && (
        <div className="fixed inset-0 z-30 bg-black/40 transition-opacity duration-300" onClick={onToggle} />
      )}

      {/* Sidebar panel */}
      <aside
        className={`
          fixed top-0 left-0 h-full z-40
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
            onClick={onToggle}
            className="p-1.5 rounded-lg hover:bg-[var(--color-notebook-surface-alt)] text-[var(--color-notebook-muted)] hover:text-[var(--color-notebook-text)] transition-colors shrink-0"
            title="Collapse sidebar (⌘\)"
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
              onChange={(e) => onTextSearch(e.target.value)}
              placeholder={isArchiveView ? "Filter archive..." : "Filter entries..."}
              className="w-full text-sm bg-[var(--color-notebook-surface-alt)] border border-[var(--color-notebook-border)] rounded-lg pl-8 pr-7 py-2 outline-none focus:bg-[var(--color-notebook-surface)] transition-all text-[var(--color-notebook-text)] placeholder:text-[var(--color-notebook-muted)] sidebar-filter-input"
              autoComplete="off"
              data-1p-ignore
            />
            {textQuery && (
              <button onClick={() => onTextSearch("")} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                  <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            )}
          </div>
          <div className="flex items-center justify-between mt-2 px-2">
            {isArchiveView ? (
              <p className="text-[11px] uppercase tracking-wider text-amber-500 font-medium flex items-center gap-2">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="21 8 21 21 3 21 3 8" /><rect x="1" y="3" width="22" height="5" /><line x1="10" y1="12" x2="14" y2="12" />
                </svg>
                Archive
              </p>
            ) : (
              <button onClick={() => { onSearchOpen(); if (isMobile) onToggle(); }} className="text-sm text-[var(--color-notebook-muted)] hover:text-[var(--color-notebook-text)] transition-colors">
                Full search <kbd className="px-1.5 py-0.5 bg-[var(--color-notebook-surface-alt)] rounded text-[10px]">⌘K</kbd>
              </button>
            )}
            <SidebarSettings
              settingsOpen={settingsOpen}
              setSettingsOpen={setSettingsOpen}
              settingsRef={settingsRef}
              isArchiveView={isArchiveView}
              onToggleArchiveView={onToggleArchiveView}
              archivedCount={archivedCount}
              onToggleAI={onToggleAI}
              aiEnabled={aiEnabled}
              fileInputRef={fileInputRef}
              onDeleteAll={onDeleteAll}
              themeId={themeId}
              onSetTheme={onSetTheme}
              fontFamily={fontFamily}
              onSetFont={onSetFont}
            />
          </div>
        </div>

        {/* Day list */}
        <SidebarDayList
          dayKeys={dayKeys}
          entriesByDay={entriesByDay}
          isArchiveView={isArchiveView}
          activeDayKey={activeDayKey}
          onDayClick={(dayKey: string) => {
            onDayClick(dayKey);
            if (isMobile) onToggle();
          }}
        />

        {/* Tags */}
        {!isArchiveView && (
          <SidebarTagCloud
            allTags={allTags}
            selectedTags={selectedTags}
            onToggleTag={onToggleTag}
          />
        )}

        {/* Import file input */}
        <ImportExport fileInputRef={fileInputRef} onRefresh={onRefresh} />
      </aside>

      {/* Import toast is rendered by ImportExport */}
    </>
  );
}
