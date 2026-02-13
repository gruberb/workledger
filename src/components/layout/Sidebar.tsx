import { useState, useRef, useEffect, useCallback } from "react";
import { formatDayKey, todayKey } from "../../utils/dates.ts";
import { getTagColor } from "../../utils/tag-colors.ts";
import { exportAllEntries, importEntries } from "../../storage/import-export.ts";

function SidebarSettings({
  settingsOpen,
  setSettingsOpen,
  settingsRef,
  isArchiveView,
  onToggleArchiveView,
  archivedCount,
  onToggleAI,
  aiEnabled,
  fileInputRef,
  onDeleteAll,
}: {
  settingsOpen: boolean;
  setSettingsOpen: (open: boolean) => void;
  settingsRef: React.RefObject<HTMLDivElement | null>;
  isArchiveView: boolean;
  onToggleArchiveView: () => void;
  archivedCount: number;
  onToggleAI?: () => void;
  aiEnabled?: boolean;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  onDeleteAll?: () => void;
}) {
  const [confirmDeleteAll, setConfirmDeleteAll] = useState(false);

  return (
    <div className="relative" ref={settingsRef}>
      <button
        onClick={() => setSettingsOpen(!settingsOpen)}
        className={`p-1 rounded-lg hover:bg-gray-100 transition-colors ${settingsOpen ? "bg-gray-100 text-gray-600" : "text-gray-400 hover:text-gray-600"}`}
        title="Settings"
      >
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="3" />
          <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
        </svg>
      </button>

      {settingsOpen && (
        <div className="absolute right-0 top-full mt-1 w-52 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-50">
          <button
            onClick={() => {
              onToggleArchiveView();
              setSettingsOpen(false);
            }}
            className="w-full text-left px-3 py-2 text-sm text-gray-600 hover:bg-gray-50 transition-colors flex items-center gap-2"
          >
            {isArchiveView ? (
              <>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="15 18 9 12 15 6" />
                </svg>
                Back to entries
              </>
            ) : (
              <>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="21 8 21 21 3 21 3 8" />
                  <rect x="1" y="3" width="22" height="5" />
                  <line x1="10" y1="12" x2="14" y2="12" />
                </svg>
                View archive
                {archivedCount > 0 && (
                  <span className="ml-auto text-[10px] bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full font-medium">
                    {archivedCount}
                  </span>
                )}
              </>
            )}
          </button>

          {onToggleAI && (
            <>
              <div className="my-1 border-t border-gray-100" />
              <button
                onClick={() => {
                  onToggleAI();
                  setSettingsOpen(false);
                }}
                className="w-full text-left px-3 py-2 text-sm text-gray-600 hover:bg-gray-50 transition-colors flex items-center gap-2"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 2a8 8 0 0 0-8 8c0 3.36 2.07 6.24 5 7.42V19a1 1 0 0 0 1 1h4a1 1 0 0 0 1-1v-1.58c2.93-1.18 5-4.06 5-7.42a8 8 0 0 0-8-8z" />
                  <line x1="9" y1="22" x2="15" y2="22" />
                </svg>
                {aiEnabled ? "Disable AI" : "Enable AI"}
                {aiEnabled && (
                  <span className="ml-auto w-2 h-2 rounded-full bg-green-500" />
                )}
              </button>
            </>
          )}

          <div className="my-1 border-t border-gray-100" />

          <button
            onClick={() => {
              exportAllEntries();
              setSettingsOpen(false);
            }}
            className="w-full text-left px-3 py-2 text-sm text-gray-600 hover:bg-gray-50 transition-colors flex items-center gap-2"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
            Export entries
          </button>

          <button
            onClick={() => {
              fileInputRef.current?.click();
              setSettingsOpen(false);
            }}
            className="w-full text-left px-3 py-2 text-sm text-gray-600 hover:bg-gray-50 transition-colors flex items-center gap-2"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="17 8 12 3 7 8" />
              <line x1="12" y1="3" x2="12" y2="15" />
            </svg>
            Import entries
          </button>

          {onDeleteAll && (
            <>
              <div className="my-1 border-t border-gray-100" />
              {confirmDeleteAll ? (
                <div className="px-3 py-2 flex items-center gap-2">
                  <span className="text-xs text-red-500">Delete everything?</span>
                  <button
                    onClick={() => {
                      onDeleteAll();
                      setConfirmDeleteAll(false);
                      setSettingsOpen(false);
                    }}
                    className="text-xs text-red-600 hover:text-red-700 font-medium"
                  >
                    Yes
                  </button>
                  <button
                    onClick={() => setConfirmDeleteAll(false)}
                    className="text-xs text-gray-400 hover:text-gray-500"
                  >
                    No
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setConfirmDeleteAll(true)}
                  className="w-full text-left px-3 py-2 text-sm text-red-500 hover:bg-red-50 transition-colors flex items-center gap-2"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="3 6 5 6 21 6" />
                    <path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6" />
                    <path d="M10 11v6" />
                    <path d="M14 11v6" />
                  </svg>
                  Delete all entries
                </button>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

interface SidebarProps {
  dayKeys: string[];
  entriesByDay: Map<string, unknown[]>;
  isOpen: boolean;
  onToggle: () => void;
  onDayClick: (dayKey: string) => void;
  sidebarSearchQuery: string;
  onSidebarSearch: (query: string) => void;
  onSearchOpen: () => void;
  allTags: string[];
  onTagClick: (tag: string) => void;
  onRefresh: () => void;
  isArchiveView: boolean;
  onToggleArchiveView: () => void;
  archivedCount: number;
  activeDayKey?: string | null;
  onDeleteAll?: () => void;
  aiEnabled?: boolean;
  onToggleAI?: () => void;
}

export function Sidebar({
  dayKeys,
  entriesByDay,
  isOpen,
  onToggle,
  onDayClick,
  sidebarSearchQuery,
  onSidebarSearch,
  onSearchOpen,
  allTags,
  onTagClick,
  onRefresh,
  isArchiveView,
  onToggleArchiveView,
  archivedCount,
  activeDayKey,
  onDeleteAll,
  aiEnabled,
  onToggleAI,
}: SidebarProps) {
  const today = todayKey();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importStatus, setImportStatus] = useState<string | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [tagsExpanded, setTagsExpanded] = useState(true);
  const [tagsHeight, setTagsHeight] = useState(120);
  const dragRef = useRef<{ startY: number; startHeight: number } | null>(null);
  const settingsRef = useRef<HTMLDivElement>(null);

  const handleDragStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    dragRef.current = { startY: e.clientY, startHeight: tagsHeight };

    const onMove = (ev: MouseEvent) => {
      if (!dragRef.current) return;
      const delta = dragRef.current.startY - ev.clientY;
      const newHeight = Math.max(60, Math.min(300, dragRef.current.startHeight + delta));
      setTagsHeight(newHeight);
    };
    const onUp = () => {
      dragRef.current = null;
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
    };
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  }, [tagsHeight]);

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
          className="fixed top-4 left-4 z-50 p-2 rounded-lg hover:bg-gray-100 transition-all duration-300 text-gray-400 hover:text-gray-600"
          title="Expand sidebar (⌘\)"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="9 18 15 12 9 6" />
          </svg>
        </button>
      )}

      {/* Sidebar panel */}
      <aside
        className={`
          fixed top-0 left-0 h-full z-40
          bg-white border-r border-gray-100
          shadow-[1px_0_12px_rgba(0,0,0,0.03)]
          transition-transform duration-300 ease-in-out
          w-80 pt-[23px] pb-5 px-[22px]
          flex flex-col
          ${isOpen ? "translate-x-0" : "-translate-x-full"}
        `}
      >
        {/* Header row: logo + title + collapse chevron */}
        <div className="mb-6 flex items-center gap-3 shrink-0">
          <a href="https://about.workledger.org" target="_blank" rel="noopener" className="flex items-center gap-3 flex-1 min-w-0">
            <img src="/logo.svg" alt="WorkLedger" className="w-9 h-9 shrink-0" />
            <div className="flex-1 min-w-0">
              <h1 className="text-3xl text-gray-800 sidebar-title-font leading-tight">
                WorkLedger
              </h1>
              <p className="text-xs text-gray-400 -mt-0.5">
                Engineering Notebook
              </p>
            </div>
          </a>
          <button
            onClick={onToggle}
            className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors shrink-0"
            title="Collapse sidebar (⌘\)"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 18 9 12 15 6" />
            </svg>
          </button>
        </div>

        {/* Search filter input — always visible */}
        <div className="mb-5 shrink-0">
          <div className="relative">
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"
            >
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <input
              type="text"
              value={sidebarSearchQuery}
              onChange={(e) => onSidebarSearch(e.target.value)}
              placeholder={isArchiveView ? "Filter archive..." : "Filter entries..."}
              className="w-full text-sm bg-gray-50 border border-gray-200 rounded-lg pl-8 pr-7 py-2 outline-none focus:border-orange-300 focus:bg-white focus:ring-1 focus:ring-orange-100 transition-all text-gray-600 placeholder:text-gray-400"
              autoComplete="off"
              data-1p-ignore
            />
            {sidebarSearchQuery && (
              <button
                onClick={() => onSidebarSearch("")}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            )}
          </div>
          {/* Below-filter row: label on left + gear on right */}
          <div className="flex items-center justify-between mt-2 px-2">
            {isArchiveView ? (
              <p className="text-[11px] uppercase tracking-wider text-amber-500 font-medium flex items-center gap-2">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="21 8 21 21 3 21 3 8" />
                  <rect x="1" y="3" width="22" height="5" />
                  <line x1="10" y1="12" x2="14" y2="12" />
                </svg>
                Archive
              </p>
            ) : (
              <button
                onClick={onSearchOpen}
                className="text-sm text-gray-400 hover:text-gray-500 transition-colors"
              >
                Full search <kbd className="px-1.5 py-0.5 bg-gray-100 rounded text-[10px]">⌘K</kbd>
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
            />
          </div>
        </div>

        {/* Day list — scrollable, takes remaining space */}
        <nav className="flex-1 overflow-y-auto -mx-2 min-h-0">
          {dayKeys.length === 0 ? (
            <p className="text-sm text-gray-400 px-2">
              {isArchiveView ? "No archived entries" : "No entries yet"}
            </p>
          ) : (
            dayKeys.map((dayKey) => {
              const count = entriesByDay.get(dayKey)?.length || 0;
              const isToday = dayKey === today && !isArchiveView;
              const isActive = activeDayKey === dayKey && !isArchiveView;
              return (
                <button
                  key={dayKey}
                  onClick={() => onDayClick(dayKey)}
                  className={`
                    w-full text-left px-3 py-2.5 rounded-lg text-base
                    transition-colors duration-150
                    flex items-center justify-between gap-2
                    ${
                      isActive
                        ? "bg-orange-50 text-orange-700 font-medium"
                        : isToday && !activeDayKey
                          ? "bg-orange-50 text-orange-700 font-medium"
                          : "text-gray-600 hover:bg-gray-50"
                    }
                  `}
                >
                  <span className="truncate">
                    {formatDayKey(dayKey)}
                  </span>
                  <span className="flex items-center gap-1.5">
                    {count > 0 && (
                      <span
                        className={`
                          w-1.5 h-1.5 rounded-full
                          ${isActive || (isToday && !activeDayKey) ? "bg-orange-400" : "bg-gray-300"}
                        `}
                      />
                    )}
                    <span className={`text-xs ${isActive || (isToday && !activeDayKey) ? "text-orange-500" : "text-gray-400"}`}>{count}</span>
                  </span>
                </button>
              );
            })
          )}
        </nav>

        {/* Tags section — pinned at bottom, collapsible + resizable, hidden in archive view */}
        {!isArchiveView && allTags.length > 0 && (
          <div className="shrink-0 mt-1">
            {/* Drag handle */}
            {tagsExpanded && (
              <div
                onMouseDown={handleDragStart}
                className="h-2 cursor-row-resize flex items-center justify-center group"
              >
                <div className="w-8 h-0.5 rounded-full bg-gray-200 group-hover:bg-gray-400 transition-colors" />
              </div>
            )}
            <div className="border-t border-gray-100 pt-2">
              <button
                onClick={() => setTagsExpanded((prev) => !prev)}
                className="flex items-center gap-1.5 w-full text-left px-1 mb-2"
              >
                <svg
                  width="10"
                  height="10"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className={`text-gray-400 transition-transform duration-200 ${tagsExpanded ? "rotate-90" : ""}`}
                >
                  <polyline points="9 18 15 12 9 6" />
                </svg>
                <span className={`uppercase tracking-wider text-gray-400 font-medium ${tagsExpanded ? "text-[11px]" : "text-xs"}`}>
                  Tags
                </span>
                <span className={`text-gray-300 ml-1 ${tagsExpanded ? "text-[10px]" : "text-[11px]"}`}>{allTags.length}</span>
              </button>
              {tagsExpanded && (
                <div
                  className="flex flex-wrap gap-1.5 px-1 overflow-y-auto"
                  style={{ maxHeight: tagsHeight }}
                >
                  {allTags.map((tag) => (
                    <button
                      key={tag}
                      onClick={() => onTagClick(tag)}
                      className={`
                        px-2 py-0.5 rounded-full text-[11px] font-medium
                        transition-opacity hover:opacity-80
                        ${getTagColor(tag)}
                        ${sidebarSearchQuery === tag ? "ring-2 ring-offset-1 ring-gray-300" : ""}
                      `}
                    >
                      {tag}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Hidden file input for import */}
        <input
          ref={fileInputRef}
          type="file"
          accept=".json"
          className="hidden"
          onChange={async (e) => {
            const file = e.target.files?.[0];
            if (!file) return;
            try {
              const result = await importEntries(file);
              setImportStatus(`${result.imported} imported, ${result.skipped} skipped`);
              onRefresh();
              setTimeout(() => setImportStatus(null), 4000);
            } catch {
              setImportStatus("Import failed: invalid file");
              setTimeout(() => setImportStatus(null), 4000);
            }
            e.target.value = "";
          }}
        />

      </aside>

      {/* Import toast — fixed top center */}
      {importStatus && (
        <div className="fixed top-5 left-1/2 -translate-x-1/2 z-[100] animate-fade-in">
          <div className={`
            px-4 py-2.5 rounded-full shadow-lg text-sm font-medium
            ${importStatus.startsWith("Import failed")
              ? "bg-red-50 text-red-700 border border-red-200"
              : "bg-green-50 text-green-700 border border-green-200"
            }
          `}>
            {importStatus}
          </div>
        </div>
      )}
    </>
  );
}
