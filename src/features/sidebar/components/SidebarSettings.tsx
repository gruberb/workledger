import { useState, useRef, useCallback, useMemo, type ReactNode } from "react";
import { exportAllEntries } from "../../entries/index.ts";
import { useClickOutside } from "../../../hooks/useClickOutside.ts";
import { useSidebarUI, useSidebarData } from "../context/SidebarContext.tsx";
import { SettingsMenuContext, type SettingsMenuControls } from "../context/SettingsMenuContext.ts";
import { SettingsMenuDivider, SettingsMenuItem, settingsMutedClass } from "./SettingsMenu.tsx";

interface SidebarSettingsProps {
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  /** Items composed in by the app (theme, AI, storage...), shown after the view toggles. */
  children?: ReactNode;
}

const backIcon = (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6" /></svg>
);

export function SidebarSettings({ fileInputRef, children }: SidebarSettingsProps) {
  const { archiveView, toggleArchiveView, reviewView, toggleReviewView } = useSidebarUI();
  const { archivedCount, handleDeleteAll } = useSidebarData();
  const [open, setOpen] = useState(false);
  const [submenu, setSubmenu] = useState<ReactNode>(null);
  const [confirmDeleteAll, setConfirmDeleteAll] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const close = useCallback(() => {
    setOpen(false);
    setSubmenu(null);
    setConfirmDeleteAll(false);
  }, []);
  useClickOutside(menuRef, close, open);

  const controls = useMemo<SettingsMenuControls>(() => ({
    openSubmenu: setSubmenu,
    back: () => setSubmenu(null),
    close,
  }), [close]);

  return (
    <div className="relative" ref={menuRef}>
      <button
        onClick={() => (open ? close() : setOpen(true))}
        className={`p-1 rounded-lg hover:bg-[var(--color-notebook-surface-alt)] transition-colors ${open ? "bg-[var(--color-notebook-surface-alt)] text-[var(--color-notebook-text)]" : `${settingsMutedClass} hover:text-[var(--color-notebook-text)]`}`}
        title="Settings"
        aria-label="Settings"
        aria-expanded={open}
        aria-haspopup="menu"
      >
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="3" />
          <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
        </svg>
      </button>

      {open && (
        <SettingsMenuContext.Provider value={controls}>
          <div className="absolute right-0 top-full mt-1 w-64 bg-[var(--color-notebook-surface)] rounded-lg shadow-lg border border-[var(--color-notebook-border)] py-1 z-50" role="menu" aria-label="Settings menu">
            {submenu ?? (
              <>
                <SettingsMenuItem onClick={toggleArchiveView}>
                  {archiveView ? (
                    <>{backIcon}Back to entries</>
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
                </SettingsMenuItem>

                <SettingsMenuItem onClick={toggleReviewView}>
                  {reviewView ? (
                    <>{backIcon}Back to entries</>
                  ) : (
                    <>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                        <line x1="16" y1="2" x2="16" y2="6" />
                        <line x1="8" y1="2" x2="8" y2="6" />
                        <line x1="3" y1="10" x2="21" y2="10" />
                      </svg>
                      Weekly review
                    </>
                  )}
                </SettingsMenuItem>

                {children}

                <SettingsMenuDivider />

                <SettingsMenuItem onClick={exportAllEntries}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" />
                  </svg>
                  Export entries
                </SettingsMenuItem>

                <SettingsMenuItem onClick={() => fileInputRef.current?.click()}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" />
                  </svg>
                  Import entries
                </SettingsMenuItem>

                <SettingsMenuDivider />
                {confirmDeleteAll ? (
                  <div className="px-3 py-2 flex items-center gap-2">
                    <span className="text-xs text-red-500">Delete everything?</span>
                    <button onClick={() => { handleDeleteAll(); close(); }} className="text-xs text-red-600 hover:text-red-700 font-medium">Yes</button>
                    <button onClick={() => setConfirmDeleteAll(false)} className={`text-xs ${settingsMutedClass}`}>No</button>
                  </div>
                ) : (
                  <button
                    role="menuitem"
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
        </SettingsMenuContext.Provider>
      )}
    </div>
  );
}
