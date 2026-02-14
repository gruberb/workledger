import { useState } from "react";
import { exportAllEntries } from "../../entries/index.ts";
import { THEME_PRESETS, FONT_OPTIONS, type ThemeId, type FontFamily } from "../../theme/index.ts";
import { StorageSubmenu, useSyncContext } from "../../sync/index.ts";

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
  themeId: ThemeId;
  onSetTheme: (id: ThemeId) => void;
  fontFamily: FontFamily;
  onSetFont: (f: FontFamily) => void;
}

type Submenu = "theme" | "font" | "storage" | null;

const menuItemClass = "w-full text-left px-3 py-2 text-sm text-[var(--color-notebook-text)] hover:bg-[var(--color-notebook-surface-alt)] transition-colors flex items-center gap-2";
const mutedClass = "text-[var(--color-notebook-muted)]";
const dividerClass = "my-1 border-t border-[var(--color-notebook-border)]";

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
  themeId,
  onSetTheme,
  fontFamily,
  onSetFont,
}: SidebarSettingsProps) {
  const [confirmDeleteAll, setConfirmDeleteAll] = useState(false);
  const [submenu, setSubmenu] = useState<Submenu>(null);
  const { config: syncConfig } = useSyncContext();

  const handleClose = () => {
    setSettingsOpen(false);
    setSubmenu(null);
  };

  const activeTheme = THEME_PRESETS.find((p) => p.id === themeId);
  const activeFont = FONT_OPTIONS.find((f) => f.id === fontFamily);

  return (
    <div className="relative" ref={settingsRef}>
      <button
        onClick={() => {
          if (settingsOpen) {
            handleClose();
          } else {
            setSettingsOpen(true);
            setSubmenu(null);
          }
        }}
        className={`p-1 rounded-lg hover:bg-[var(--color-notebook-surface-alt)] transition-colors ${settingsOpen ? "bg-[var(--color-notebook-surface-alt)] text-[var(--color-notebook-text)]" : `${mutedClass} hover:text-[var(--color-notebook-text)]`}`}
        title="Settings"
      >
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="3" />
          <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
        </svg>
      </button>

      {settingsOpen && (
        <div className="absolute right-0 top-full mt-1 w-64 bg-[var(--color-notebook-surface)] rounded-lg shadow-lg border border-[var(--color-notebook-border)] py-1 z-50">
          {submenu === null && (
            <>
              {/* Archive toggle */}
              <button
                onClick={() => { onToggleArchiveView(); handleClose(); }}
                className={menuItemClass}
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
                <button
                  onClick={() => { onToggleAI(); handleClose(); }}
                  className={menuItemClass}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 2a8 8 0 0 0-8 8c0 3.36 2.07 6.24 5 7.42V19a1 1 0 0 0 1 1h4a1 1 0 0 0 1-1v-1.58c2.93-1.18 5-4.06 5-7.42a8 8 0 0 0-8-8z" />
                    <line x1="9" y1="22" x2="15" y2="22" />
                  </svg>
                  {aiEnabled ? "Disable AI" : "Enable AI"}
                  {aiEnabled && <span className="ml-auto w-2 h-2 rounded-full bg-green-500" />}
                </button>
              )}

              <div className={dividerClass} />

              {/* Theme trigger */}
              <button
                onClick={() => setSubmenu("theme")}
                className={menuItemClass}
              >
                <span
                  className="w-3 h-3 rounded-full shrink-0 border border-black/10"
                  style={{ backgroundColor: activeTheme?.accentColor }}
                />
                <span className="flex-1">Theme</span>
                <span className={`text-xs ${mutedClass} truncate max-w-[70px]`}>{activeTheme?.label}</span>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={mutedClass}>
                  <polyline points="9 18 15 12 9 6" />
                </svg>
              </button>

              {/* Font trigger */}
              <button
                onClick={() => setSubmenu("font")}
                className={menuItemClass}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="4 7 4 4 20 4 20 7" /><line x1="9" y1="20" x2="15" y2="20" /><line x1="12" y1="4" x2="12" y2="20" />
                </svg>
                <span className="flex-1">Note font</span>
                <span className={`text-xs ${mutedClass} truncate max-w-[70px]`}>{activeFont?.label}</span>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={mutedClass}>
                  <polyline points="9 18 15 12 9 6" />
                </svg>
              </button>

              {/* Storage trigger */}
              <button
                onClick={() => setSubmenu("storage")}
                className={menuItemClass}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z" />
                </svg>
                <span className="flex-1">Storage</span>
                <span className={`text-xs ${mutedClass} truncate max-w-[70px]`}>{syncConfig.mode === "remote" ? "Remote" : "Local"}</span>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={mutedClass}>
                  <polyline points="9 18 15 12 9 6" />
                </svg>
              </button>

              <div className={dividerClass} />

              <button
                onClick={() => { exportAllEntries(); handleClose(); }}
                className={menuItemClass}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" />
                </svg>
                Export entries
              </button>

              <button
                onClick={() => { fileInputRef.current?.click(); handleClose(); }}
                className={menuItemClass}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" />
                </svg>
                Import entries
              </button>

              {onDeleteAll && (
                <>
                  <div className={dividerClass} />
                  {confirmDeleteAll ? (
                    <div className="px-3 py-2 flex items-center gap-2">
                      <span className="text-xs text-red-500">Delete everything?</span>
                      <button onClick={() => { onDeleteAll(); setConfirmDeleteAll(false); handleClose(); }} className="text-xs text-red-600 hover:text-red-700 font-medium">Yes</button>
                      <button onClick={() => setConfirmDeleteAll(false)} className={`text-xs ${mutedClass}`}>No</button>
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
            </>
          )}

          {/* Theme submenu */}
          {submenu === "theme" && (
            <>
              <button
                onClick={() => setSubmenu(null)}
                className={`w-full text-left px-3 py-2 text-sm ${mutedClass} hover:bg-[var(--color-notebook-surface-alt)] transition-colors flex items-center gap-1.5`}
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="15 18 9 12 15 6" />
                </svg>
                <span className="text-[10px] uppercase tracking-wider font-medium">Theme</span>
              </button>
              <div className={dividerClass} />
              {THEME_PRESETS.map((preset) => (
                <button
                  key={preset.id}
                  onClick={() => onSetTheme(preset.id)}
                  className="w-full text-left px-3 py-1.5 text-sm text-[var(--color-notebook-text)] hover:bg-[var(--color-notebook-surface-alt)] transition-colors flex items-center gap-2.5"
                >
                  <span
                    className="w-3 h-3 rounded-full shrink-0 border border-black/10"
                    style={{ backgroundColor: preset.accentColor }}
                  />
                  <span className="flex-1">{preset.label}</span>
                  {themeId === preset.id && (
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-green-500 shrink-0">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  )}
                </button>
              ))}
            </>
          )}

          {/* Font submenu */}
          {submenu === "font" && (
            <>
              <button
                onClick={() => setSubmenu(null)}
                className={`w-full text-left px-3 py-2 text-sm ${mutedClass} hover:bg-[var(--color-notebook-surface-alt)] transition-colors flex items-center gap-1.5`}
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="15 18 9 12 15 6" />
                </svg>
                <span className="text-[10px] uppercase tracking-wider font-medium">Note Font</span>
              </button>
              <div className={dividerClass} />
              {FONT_OPTIONS.map((font) => (
                <button
                  key={font.id}
                  onClick={() => onSetFont(font.id)}
                  className="w-full text-left px-3 py-1.5 text-sm text-[var(--color-notebook-text)] hover:bg-[var(--color-notebook-surface-alt)] transition-colors flex items-center gap-2.5"
                >
                  <span className="flex-1" style={{ fontFamily: font.cssValue }}>{font.label}</span>
                  {fontFamily === font.id && (
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-green-500 shrink-0">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  )}
                </button>
              ))}
            </>
          )}

          {/* Storage submenu */}
          {submenu === "storage" && (
            <StorageSubmenu
              menuItemClass={menuItemClass}
              mutedClass={mutedClass}
              dividerClass={dividerClass}
              onBack={() => setSubmenu(null)}
            />
          )}
        </div>
      )}
    </div>
  );
}
