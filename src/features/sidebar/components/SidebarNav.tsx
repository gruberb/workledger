import type { ReactNode } from "react";
import { ArchiveIcon, CalendarIcon, JournalIcon, SearchIcon } from "../../../components/ui/Icons.tsx";
import { useSidebarData, useSidebarUI, type SidebarView } from "../context/SidebarContext.tsx";

interface SidebarNavProps {
  onSearch: () => void;
  /** Called after any row is chosen (the mobile drawer closes itself here). */
  onSelect: () => void;
}

interface NavRowProps {
  icon: ReactNode;
  label: string;
  active?: boolean;
  trailing?: ReactNode;
  onClick: () => void;
}

function NavRow({ icon, label, active, trailing, onClick }: NavRowProps) {
  return (
    <button
      onClick={onClick}
      aria-current={active ? "page" : undefined}
      className={`w-full flex items-center gap-3 px-3 py-2.5 md:py-2 rounded-lg text-sm transition-colors ${
        active
          ? "sidebar-day-active font-medium"
          : "text-[var(--color-notebook-muted)] hover:bg-[var(--color-notebook-surface-alt)] hover:text-[var(--color-notebook-text)]"
      }`}
    >
      {icon}
      <span className="flex-1 text-left">{label}</span>
      {trailing}
    </button>
  );
}

const VIEWS: { view: SidebarView; label: string; icon: ReactNode }[] = [
  { view: "journal", label: "Journal", icon: <JournalIcon size={16} /> },
  { view: "review", label: "Weekly review", icon: <CalendarIcon size={16} /> },
  { view: "archive", label: "Archive", icon: <ArchiveIcon size={16} /> },
];

/** Search plus the three views. Always visible, so no view hides in a menu. */
export function SidebarNav({ onSearch, onSelect }: SidebarNavProps) {
  const { archiveView, reviewView, setView } = useSidebarUI();
  const { archivedCount } = useSidebarData();
  const current: SidebarView = archiveView ? "archive" : reviewView ? "review" : "journal";

  return (
    <nav className="mb-4 shrink-0 space-y-0.5" aria-label="Views">
      <NavRow
        icon={<SearchIcon size={16} />}
        label="Search"
        trailing={<kbd className="max-md:hidden px-1.5 py-0.5 bg-[var(--color-notebook-surface-alt)] rounded text-[10px] text-[var(--color-notebook-muted)]">⌘K</kbd>}
        onClick={() => { onSearch(); onSelect(); }}
      />
      {VIEWS.map(({ view, label, icon }) => (
        <NavRow
          key={view}
          icon={icon}
          label={label}
          active={current === view}
          trailing={view === "archive" && archivedCount > 0 ? (
            <span className="text-[10px] bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 px-1.5 py-0.5 rounded-full font-medium">{archivedCount}</span>
          ) : undefined}
          onClick={() => { setView(view); onSelect(); }}
        />
      ))}
    </nav>
  );
}
