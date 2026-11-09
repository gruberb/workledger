import type { ReactNode } from "react";
import { MenuIcon, SearchIcon } from "../../components/ui/Icons.tsx";

interface HeaderButtonProps {
  label: string;
  onClick: () => void;
  children: ReactNode;
  title?: string;
  /** Set for toggles (e.g. a panel): shows the pressed state instead of hiding the button. */
  pressed?: boolean;
}

/** Square icon button for the header; other controls in the header use it too. */
export function HeaderButton({ label, onClick, children, title, pressed }: HeaderButtonProps) {
  return (
    <button
      onClick={onClick}
      className="header-button shrink-0"
      title={title ?? label}
      aria-label={label}
      aria-pressed={pressed}
    >
      {children}
    </button>
  );
}

interface AppHeaderProps {
  /** Centered title, e.g. the view menu. */
  title: ReactNode;
  /** The sidebar is open; the menu button shows as pressed, like the AI sidebar toggle. */
  sidebarOpen: boolean;
  onMenu: () => void;
  onSearch: () => void;
  /** Extra controls after search, e.g. the new-entry and AI buttons. */
  actions?: ReactNode;
  /**
   * Active filters. Replace the centered title and search with one left-aligned
   * bar; search stays on ⌘K.
   */
  filters?: ReactNode;
}

/** Slim top bar for every screen size: menu, current view, search, extra actions. */
export function AppHeader({ title, sidebarOpen, onMenu, onSearch, actions, filters }: AppHeaderProps) {
  // Always shown, pressed while open: the left and right panel toggles behave the same.
  const menuButton = (
    <HeaderButton label={sidebarOpen ? "Close sidebar" : "Open sidebar"} title={`${sidebarOpen ? "Close" : "Open"} sidebar (⌘\\)`} pressed={sidebarOpen} onClick={onMenu}>
      <MenuIcon size={18} />
    </HeaderButton>
  );

  if (filters) {
    return (
      <header className="sticky top-0 z-20 h-[var(--app-header-h)] bg-[var(--color-notebook-bg)] border-b-[1.5px] border-[var(--color-notebook-frame)]">
        <div className="h-full w-full flex items-center gap-3 px-4 md:px-12">
          {menuButton}
          <div className="flex-1 min-w-0">{filters}</div>
          {actions && <div className="flex items-center gap-2 shrink-0">{actions}</div>}
        </div>
      </header>
    );
  }

  return (
    <header className="sticky top-0 z-20 h-[var(--app-header-h)] bg-[var(--color-notebook-bg)] border-b-[1.5px] border-[var(--color-notebook-frame)]">
      {/* Equal side columns keep the title centered, so collapsing the sidebar (which
          adds the menu button) does not shift it. */}
      <div className="h-full w-full mx-auto grid grid-cols-[1fr_auto_1fr] items-center gap-2 px-4 md:px-12">
        <div className="flex items-center">{menuButton}</div>
        <div className="min-w-0">{title}</div>
        <div className="flex items-center justify-end gap-2">
          {/* A field-shaped button on wide screens, an icon on narrow ones. */}
          <button className="header-search max-lg:hidden" onClick={onSearch} title="Search (⌘K)">
            <SearchIcon size={16} />
            <span className="w-28 text-left">Search notes</span>
            <kbd>⌘K</kbd>
          </button>
          <span className="lg:hidden">
            <HeaderButton label="Search" title="Search (⌘K)" onClick={onSearch}>
              <SearchIcon size={18} />
            </HeaderButton>
          </span>
          {actions}
        </div>
      </div>
    </header>
  );
}
