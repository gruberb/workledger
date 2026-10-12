import type { ReactNode } from "react";
import { MenuIcon, SearchIcon } from "../../components/ui/Icons.tsx";

interface HeaderButtonProps {
  label: string;
  onClick: () => void;
  children: ReactNode;
  title?: string;
}

/** Round icon button sized for the header; other controls in the header use it too. */
export function HeaderButton({ label, onClick, children, title }: HeaderButtonProps) {
  return (
    <button
      onClick={onClick}
      className="w-9 h-9 rounded-full border border-[var(--color-notebook-border)] bg-[var(--color-notebook-surface)] text-[var(--color-notebook-muted)] hover:text-[var(--color-notebook-text)] flex items-center justify-center shadow-sm transition-colors shrink-0"
      title={title ?? label}
      aria-label={label}
    >
      {children}
    </button>
  );
}

interface AppHeaderProps {
  /** Name of the current view. */
  title: string;
  /** The menu button opens the sidebar; hide it while the sidebar is docked open. */
  showMenu: boolean;
  onMenu: () => void;
  onSearch: () => void;
  /** Extra controls after search, e.g. the new-entry and AI buttons. */
  actions?: ReactNode;
}

/** Slim top bar for every screen size: menu, current view, search, extra actions. */
export function AppHeader({ title, showMenu, onMenu, onSearch, actions }: AppHeaderProps) {
  return (
    <header className="sticky top-0 z-20 h-[var(--app-header-h)] bg-[var(--color-notebook-bg)] border-b border-[var(--color-notebook-border)]">
      <div className="h-full max-w-7xl mx-auto flex items-center gap-2 px-4 md:px-12">
        {showMenu && (
          <HeaderButton label="Open menu" title="Menu (⌘\)" onClick={onMenu}>
            <MenuIcon size={18} />
          </HeaderButton>
        )}
        <h1 className={`flex-1 min-w-0 truncate text-lg font-semibold text-[var(--color-notebook-text)] ${showMenu ? "text-center md:text-left md:pl-2" : "text-left"}`}>
          {title}
        </h1>
        <HeaderButton label="Search" title="Search (⌘K)" onClick={onSearch}>
          <SearchIcon size={18} />
        </HeaderButton>
        {actions}
      </div>
    </header>
  );
}
