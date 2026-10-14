import { useState, useRef, useCallback, useMemo, type ReactNode } from "react";
import { exportAllEntries } from "../../entries/index.ts";
import { useClickOutside } from "../../../hooks/useClickOutside.ts";
import { useSidebarData } from "../context/SidebarContext.tsx";
import { SettingsMenuContext, type SettingsMenuControls } from "../context/SettingsMenuContext.ts";
import { SettingsIcon } from "../../../components/ui/Icons.tsx";
import { SettingsMenuDivider, SettingsMenuItem, settingsMutedClass } from "./SettingsMenu.tsx";

interface SidebarSettingsProps {
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  /** Items composed in by the app (theme, AI, storage...), shown first in the menu. */
  children?: ReactNode;
}

export function SidebarSettings({ fileInputRef, children }: SidebarSettingsProps) {
  const { handleDeleteAll } = useSidebarData();
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
    <div className="relative w-full" ref={menuRef} onKeyDown={(event) => { if (event.key === "Escape" && open) { event.stopPropagation(); close(); menuRef.current?.querySelector("button")?.focus(); } }}>
      <button
        onClick={() => (open ? close() : setOpen(true))}
        className={`w-full min-h-11 px-3 rounded-md border border-[var(--color-notebook-border)] flex items-center gap-3 transition-colors hover:bg-[var(--color-notebook-surface-alt)] ${open ? "bg-[var(--color-notebook-surface-alt)] text-[var(--color-notebook-text)]" : `bg-[var(--color-notebook-surface)] ${settingsMutedClass} hover:text-[var(--color-notebook-text)]`}`}
        title="Settings"
        aria-label="Settings"
        aria-expanded={open}
        aria-haspopup="menu"
      >
        <SettingsIcon size={18} />
        <span className="text-sm font-medium">Settings</span>
      </button>

      {open && (
        <SettingsMenuContext.Provider value={controls}>
          <div className="absolute left-0 bottom-full mb-2 w-72 max-w-[calc(100vw-3rem)] max-h-[70vh] overflow-y-auto bg-[var(--color-notebook-surface)] rounded-lg shadow-lg border border-[var(--color-notebook-border)] py-1 z-50" role="menu" aria-label="Settings menu">
            {submenu ?? (
              <>
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
