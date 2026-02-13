import { useState } from "react";
import { exportAllEntries } from "../../entries/storage/import-export.ts";

interface SidebarSettingsProps {
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
  themeMode?: "light" | "dark";
  onToggleTheme?: () => void;
}

export function SidebarSettings({
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
  themeMode,
  onToggleTheme,
}: SidebarSettingsProps) {
  const [confirmDeleteAll, setConfirmDeleteAll] = useState(false);

  return (
    <div className="relative" ref={settingsRef}>
      <button
        onClick={() => setSettingsOpen(!settingsOpen)}
        className={`p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors ${settingsOpen ? "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300" : "text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"}`}
        title="Settings"
      >
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="3" />
          <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
        </svg>
      </button>

      {settingsOpen && (
        <div className="absolute right-0 top-full mt-1 w-52 bg-white dark:bg-[#1a1a1a] rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 py-1 z-50">
          {onToggleTheme && (
            <>
              <button
                onClick={() => { onToggleTheme(); setSettingsOpen(false); }}
                className="w-full text-left px-3 py-2 text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors flex items-center gap-2"
              >
                {themeMode === "dark" ? (
                  <>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="12" cy="12" r="5" />
                      <line x1="12" y1="1" x2="12" y2="3" /><line x1="12" y1="21" x2="12" y2="23" />
                      <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" /><line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
                      <line x1="1" y1="12" x2="3" y2="12" /><line x1="21" y1="12" x2="23" y2="12" />
                      <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" /><line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
                    </svg>
                    Light mode
                  </>
                ) : (
                  <>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
                    </svg>
                    Dark mode
                  </>
                )}
              </button>
              <div className="my-1 border-t border-gray-100 dark:border-gray-700" />
            </>
          )}
          <button
            onClick={() => { onToggleArchiveView(); setSettingsOpen(false); }}
            className="w-full text-left px-3 py-2 text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors flex items-center gap-2"
          >
            {isArchiveView ? (
              <>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6" /></svg>
                Back to entries
              </>
            ) : (
              <>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="21 8 21 21 3 21 3 8" /><rect x="1" y="3" width="22" height="5" /><line x1="10" y1="12" x2="14" y2="12" />
                </svg>
                View archive
                {archivedCount > 0 && (
                  <span className="ml-auto text-[10px] bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 px-1.5 py-0.5 rounded-full font-medium">{archivedCount}</span>
                )}
              </>
            )}
          </button>

          {onToggleAI && (
            <>
              <div className="my-1 border-t border-gray-100 dark:border-gray-700" />
              <button
                onClick={() => { onToggleAI(); setSettingsOpen(false); }}
                className="w-full text-left px-3 py-2 text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors flex items-center gap-2"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 2a8 8 0 0 0-8 8c0 3.36 2.07 6.24 5 7.42V19a1 1 0 0 0 1 1h4a1 1 0 0 0 1-1v-1.58c2.93-1.18 5-4.06 5-7.42a8 8 0 0 0-8-8z" />
                  <line x1="9" y1="22" x2="15" y2="22" />
                </svg>
                {aiEnabled ? "Disable AI" : "Enable AI"}
                {aiEnabled && <span className="ml-auto w-2 h-2 rounded-full bg-green-500" />}
              </button>
            </>
          )}

          <div className="my-1 border-t border-gray-100 dark:border-gray-700" />

          <button
            onClick={() => { exportAllEntries(); setSettingsOpen(false); }}
            className="w-full text-left px-3 py-2 text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors flex items-center gap-2"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" />
            </svg>
            Export entries
          </button>

          <button
            onClick={() => { fileInputRef.current?.click(); setSettingsOpen(false); }}
            className="w-full text-left px-3 py-2 text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors flex items-center gap-2"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" />
            </svg>
            Import entries
          </button>

          {onDeleteAll && (
            <>
              <div className="my-1 border-t border-gray-100 dark:border-gray-700" />
              {confirmDeleteAll ? (
                <div className="px-3 py-2 flex items-center gap-2">
                  <span className="text-xs text-red-500">Delete everything?</span>
                  <button onClick={() => { onDeleteAll(); setConfirmDeleteAll(false); setSettingsOpen(false); }} className="text-xs text-red-600 hover:text-red-700 font-medium">Yes</button>
                  <button onClick={() => setConfirmDeleteAll(false)} className="text-xs text-gray-400 hover:text-gray-500">No</button>
                </div>
              ) : (
                <button
                  onClick={() => setConfirmDeleteAll(true)}
                  className="w-full text-left px-3 py-2 text-sm text-red-500 hover:bg-red-50 dark:hover:bg-red-950 transition-colors flex items-center gap-2"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6" /><path d="M10 11v6" /><path d="M14 11v6" />
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
