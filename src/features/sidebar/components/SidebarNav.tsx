import type { ReactNode } from "react";
import { useSidebarData, useSidebarUI } from "../context/SidebarContext.tsx";
import { SIDEBAR_VIEWS } from "../utils/views.tsx";

interface SidebarNavProps {
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
      className={`w-full flex items-center gap-3 px-3 py-2.5 md:py-2 rounded-md border-2 border-transparent text-sm transition-colors ${
        active
          ? "notebook-view-active font-semibold"
          : "text-[var(--color-notebook-muted)] hover:bg-[var(--color-notebook-surface-alt)] hover:text-[var(--color-notebook-text)]"
      }`}
    >
      {icon}
      <span className="flex-1 text-left">{label}</span>
      {trailing}
    </button>
  );
}


/** The three views. Always visible, so no view hides in a menu. */
export function SidebarNav({ onSelect }: SidebarNavProps) {
  const { view: current, setView } = useSidebarUI();
  const { archivedCount } = useSidebarData();

  return (
    <nav className="mb-4 shrink-0 space-y-0.5" aria-label="Views">
      {SIDEBAR_VIEWS.map(({ view, label, icon }) => (
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
