import { memo, useCallback, useState } from "react";
import type { WorkLedgerEntry } from "../../entries/index.ts";
import { extractTitle } from "../../entries/index.ts";
import { formatDayKey, todayKey } from "../../../utils/dates.ts";
import { ChevronRightIcon } from "../../../components/ui/Icons.tsx";
import { useActiveDayKey } from "../context/SidebarContext.tsx";

interface SidebarDayRowProps {
  dayKey: string;
  /** The day's entries; the same array until one of them changes. */
  entries: WorkLedgerEntry[] | undefined;
  isHighlighted: boolean;
  expanded: boolean;
  onDayClick: (dayKey: string) => void;
  onToggle: (dayKey: string) => void;
  onEntryClick: (entryId: string) => void;
}

// One row per stored day (up to years of them). Memoized so a save in one day
// does not re-format and re-render every other row.
const SidebarDayRow = memo(function SidebarDayRow({ dayKey, entries, isHighlighted, expanded, onDayClick, onToggle, onEntryClick }: SidebarDayRowProps) {
  const count = entries?.length ?? 0;
  // Titles exist only for loaded days; older days show their count and load on click.
  const canExpand = count > 0;
  return (
    <div>
      <div className={`flex items-center rounded-md ${isHighlighted ? "sidebar-day-active" : "hover:bg-[var(--color-notebook-surface-alt)]"}`}>
        <button
          onClick={() => canExpand && onToggle(dayKey)}
          className={`w-6 h-8 md:h-7 shrink-0 flex items-center justify-center text-[var(--color-notebook-muted)] ${canExpand ? "" : "invisible"}`}
          aria-label={expanded ? "Hide entries" : "Show entries"}
          aria-expanded={expanded}
          tabIndex={canExpand ? 0 : -1}
        >
          <ChevronRightIcon size={12} className={expanded ? "rotate-90" : ""} />
        </button>
        <button
          onClick={() => onDayClick(dayKey)}
          className={`flex-1 min-w-0 text-left pr-2 py-2 md:py-1.5 text-sm flex items-center justify-between gap-2 ${isHighlighted ? "font-semibold" : "text-[var(--color-notebook-muted)] hover:text-[var(--color-notebook-text)]"}`}
        >
          <span className="truncate">{formatDayKey(dayKey)}</span>
          <span className={`text-xs tabular-nums ${isHighlighted ? "" : "opacity-70"}`}>{count}</span>
        </button>
      </div>
      {expanded && entries && (
        <ul className="ml-6 mb-1 border-l border-[var(--color-notebook-ruling)]">
          {entries.map((entry) => (
            <li key={entry.id}>
              <button
                onClick={() => onEntryClick(entry.id)}
                className="w-full text-left pl-3 pr-2 py-1 text-[13px] truncate text-[var(--color-notebook-muted)] hover:text-[var(--color-notebook-text)] hover:bg-[var(--color-notebook-surface-alt)] rounded-r-md"
              >
                {extractTitle(entry)}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
});

interface SidebarDayListProps {
  dayKeys: string[];
  entriesByDay: Map<string, WorkLedgerEntry[]>;
  isArchiveView: boolean;
  onDayClick: (dayKey: string) => void;
  onEntryClick: (entryId: string) => void;
}

export const SidebarDayList = memo(function SidebarDayList({ dayKeys, entriesByDay, isArchiveView, onDayClick, onEntryClick }: SidebarDayListProps) {
  const activeDayKey = useActiveDayKey();
  const today = todayKey();
  // Days opened or closed by hand. The day being read opens by itself unless closed.
  const [toggled, setToggled] = useState<ReadonlyMap<string, boolean>>(() => new Map());
  const handleToggle = useCallback((dayKey: string) => {
    setToggled((prev) => new Map(prev).set(dayKey, !(prev.get(dayKey) ?? dayKey === (activeDayKey ?? today))));
  }, [activeDayKey, today]);

  return (
    <nav className="flex-1 overflow-y-auto -mx-2 min-h-24" aria-label={isArchiveView ? "Archived pages" : "Recent pages"}>
      <h2 className="px-2 pt-2 pb-2 text-[11px] font-bold uppercase tracking-[0.12em] text-[var(--color-notebook-muted)]">
        {isArchiveView ? "Archived pages" : "Recent pages"}
      </h2>
      {dayKeys.length === 0 ? (
        <p className="text-sm text-[var(--color-notebook-muted)] px-2">
          {isArchiveView ? "No archived entries" : "No entries yet"}
        </p>
      ) : (
        dayKeys.map((dayKey) => {
          const isCurrent = !isArchiveView && dayKey === (activeDayKey ?? today);
          return (
            <SidebarDayRow
              key={dayKey}
              dayKey={dayKey}
              entries={entriesByDay.get(dayKey)}
              isHighlighted={isCurrent}
              expanded={toggled.get(dayKey) ?? isCurrent}
              onDayClick={onDayClick}
              onToggle={handleToggle}
              onEntryClick={onEntryClick}
            />
          );
        })
      )}
    </nav>
  );
});
