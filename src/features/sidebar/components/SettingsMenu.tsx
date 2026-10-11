import type { ReactNode } from "react";
import { useSettingsMenu } from "../context/SettingsMenuContext.ts";

// Building blocks for the sidebar settings menu, shared by the sidebar's own
// items and by items composed in from other features via the settings slot.

export const settingsMutedClass = "text-[var(--color-notebook-muted)]";
export const settingsDividerClass = "my-1 border-t border-[var(--color-notebook-border)]";
const itemClass = "w-full text-left px-3 py-2 text-sm text-[var(--color-notebook-text)] hover:bg-[var(--color-notebook-surface-alt)] transition-colors flex items-center gap-2";
const optionClass = "w-full text-left px-3 py-1.5 text-sm text-[var(--color-notebook-text)] hover:bg-[var(--color-notebook-surface-alt)] transition-colors flex items-center gap-2.5";

export function SettingsMenuDivider() {
  return <div className={settingsDividerClass} />;
}

interface SettingsMenuItemProps {
  onClick: () => void;
  children: ReactNode;
  /** Keep the menu open after the click (e.g. for confirmations). */
  keepOpen?: boolean;
}

export function SettingsMenuItem({ onClick, children, keepOpen }: SettingsMenuItemProps) {
  const { close } = useSettingsMenu();
  return (
    <button
      role="menuitem"
      onClick={() => { onClick(); if (!keepOpen) close(); }}
      className={itemClass}
    >
      {children}
    </button>
  );
}

interface SettingsSubmenuItemProps {
  icon: ReactNode;
  label: string;
  /** Current value shown on the right, e.g. the active theme. */
  detail?: string;
  submenu: ReactNode;
}

export function SettingsSubmenuItem({ icon, label, detail, submenu }: SettingsSubmenuItemProps) {
  const { openSubmenu } = useSettingsMenu();
  return (
    <button role="menuitem" aria-haspopup="menu" onClick={() => openSubmenu(submenu)} className={itemClass}>
      {icon}
      <span className="flex-1">{label}</span>
      {detail && <span className={`text-xs ${settingsMutedClass} truncate max-w-[70px]`}>{detail}</span>}
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={settingsMutedClass}>
        <polyline points="9 18 15 12 9 6" />
      </svg>
    </button>
  );
}

export function SettingsSubmenuHeader({ title }: { title: string }) {
  const { back } = useSettingsMenu();
  return (
    <>
      <button
        onClick={back}
        className={`w-full text-left px-3 py-2 text-sm ${settingsMutedClass} hover:bg-[var(--color-notebook-surface-alt)] transition-colors flex items-center gap-1.5`}
      >
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="15 18 9 12 15 6" />
        </svg>
        <span className="text-[10px] uppercase tracking-wider font-medium">{title}</span>
      </button>
      <SettingsMenuDivider />
    </>
  );
}

interface SettingsOptionProps {
  selected: boolean;
  onSelect: () => void;
  children: ReactNode;
}

/** A selectable row inside a submenu, with a check mark when active. */
export function SettingsOption({ selected, onSelect, children }: SettingsOptionProps) {
  return (
    <button role="menuitemradio" aria-checked={selected} onClick={onSelect} className={optionClass}>
      {children}
      {selected && (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-green-500 shrink-0">
          <polyline points="20 6 9 17 4 12" />
        </svg>
      )}
    </button>
  );
}
