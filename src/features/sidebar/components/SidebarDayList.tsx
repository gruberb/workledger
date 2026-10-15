import { memo } from "react";
import { formatDayKey, todayKey } from "../../../utils/dates.ts";
import { useActiveDayKey } from "../context/SidebarContext.tsx";

interface SidebarDayRowProps {
  dayKey: string;
  count: number;
  isHighlighted: boolean;
  onDayClick: (dayKey: string) => void;
}

// One row per stored day (up to years of them). Memoized on primitives so a
// save in one day does not re-format and re-render every other row.
const SidebarDayRow = memo(function SidebarDayRow({ dayKey, count, isHighlighted, onDayClick }: SidebarDayRowProps) {
  return (
    <button
      onClick={() => onDayClick(dayKey)}
      className={`
        w-full text-left px-2 py-2 md:py-1.5 rounded-md text-sm
        transition-colors duration-150
        flex items-center justify-between gap-2
        ${isHighlighted ? "sidebar-day-active font-medium" : "text-[var(--color-notebook-muted)] hover:bg-[var(--color-notebook-surface-alt)] hover:text-[var(--color-notebook-text)]"}
      `}
    >
      <span className="truncate">
        {formatDayKey(dayKey)}
      </span>
      <span className="flex items-center gap-1.5">
        {count > 0 && (
          <span
            className={`w-1.5 h-1.5 rounded-full ${isHighlighted ? "sidebar-day-dot" : "bg-gray-300 dark:bg-gray-600"}`}
          />
        )}
        <span className={`text-xs ${isHighlighted ? "sidebar-day-count" : "text-gray-400 dark:text-gray-500"}`}>{count}</span>
      </span>
    </button>
  );
});

interface SidebarDayListProps {
  dayKeys: string[];
  entriesByDay: Map<string, unknown[]>;
  isArchiveView: boolean;
  onDayClick: (dayKey: string) => void;
}

export const SidebarDayList = memo(function SidebarDayList({ dayKeys, entriesByDay, isArchiveView, onDayClick }: SidebarDayListProps) {
  const activeDayKey = useActiveDayKey();
  const today = todayKey();

  return (
    <nav className="flex-1 overflow-y-auto -mx-2 min-h-24" aria-label={isArchiveView ? "Archived pages" : "Recent pages"}>
      <h2 className="px-2 pt-2 pb-2 text-xs font-semibold uppercase tracking-widest text-[var(--color-notebook-muted)]">
        {isArchiveView ? "Archived pages" : "Recent pages"}
      </h2>
      {dayKeys.length === 0 ? (
        <p className="text-sm text-gray-400 px-2">
          {isArchiveView ? "No archived entries" : "No entries yet"}
        </p>
      ) : (
        dayKeys.map((dayKey) => {
          const isToday = dayKey === today && !isArchiveView;
          const isActive = activeDayKey === dayKey && !isArchiveView;
          return (
            <SidebarDayRow
              key={dayKey}
              dayKey={dayKey}
              count={entriesByDay.get(dayKey)?.length || 0}
              isHighlighted={isActive || (isToday && !activeDayKey)}
              onDayClick={onDayClick}
            />
          );
        })
      )}
    </nav>
  );
});
