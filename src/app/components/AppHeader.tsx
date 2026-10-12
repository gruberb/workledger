import type { ReactNode } from "react";
import { MenuIcon, SearchIcon } from "../../components/ui/Icons.tsx";

interface AppHeaderProps {
  /** Name of the current view. */
  title: string;
  /** The menu button opens the sidebar; hide it while the sidebar is docked open. */
  showMenu: boolean;
  /** Keep clear of the fixed AI sidebar toggle in the top-right corner (desktop only). */
  reserveRight?: boolean;
  onMenu: () => void;
  onSearch: () => void;
  /** Extra control after search, e.g. the new-entry button. */
  action?: ReactNode;
}

const ROUND_BUTTON = "w-9 h-9 rounded-full border border-[var(--color-notebook-border)] bg-[var(--color-notebook-surface)] text-[var(--color-notebook-muted)] hover:text-[var(--color-notebook-text)] flex items-center justify-center shadow-sm transition-colors shrink-0";

/** Slim top bar for every screen size: menu, current view, search, primary action. */
export function AppHeader({ title, showMenu, reserveRight, onMenu, onSearch, action }: AppHeaderProps) {
  return (
    <header className="sticky top-0 z-20 h-[var(--app-header-h)] bg-[var(--color-notebook-bg)] border-b border-[var(--color-notebook-border)]">
      <div className={`h-full max-w-7xl mx-auto flex items-center gap-2 px-4 md:px-12 ${reserveRight ? "md:pr-16" : ""}`}>
        {showMenu && (
          <button onClick={onMenu} className={ROUND_BUTTON} title="Menu (⌘\)" aria-label="Open menu">
            <MenuIcon size={18} />
          </button>
        )}
        <h1 className={`flex-1 min-w-0 truncate text-[15px] font-semibold text-[var(--color-notebook-text)] ${showMenu ? "text-center md:text-left md:pl-1" : "text-left"}`}>
          {title}
        </h1>
        <button onClick={onSearch} className={ROUND_BUTTON} title="Search (⌘K)" aria-label="Search">
          <SearchIcon size={18} />
        </button>
        {action}
      </div>
    </header>
  );
}
