import { memo } from "react";
import { formatDayKey, todayKey } from "../../entries/utils/dates.ts";

interface SidebarDayListProps {
  dayKeys: string[];
  entriesByDay: Map<string, unknown[]>;
  isArchiveView: boolean;
  activeDayKey?: string | null;
  onDayClick: (dayKey: string) => void;
}

export const SidebarDayList = memo(function SidebarDayList({ dayKeys, entriesByDay, isArchiveView, activeDayKey, onDayClick }: SidebarDayListProps) {
  const today = todayKey();

  return (
    <nav className="flex-1 overflow-y-auto -mx-2 min-h-0">
      {dayKeys.length === 0 ? (
        <p className="text-sm text-gray-400 px-2">
          {isArchiveView ? "No archived entries" : "No entries yet"}
        </p>
      ) : (
        dayKeys.map((dayKey) => {
          const count = entriesByDay.get(dayKey)?.length || 0;
          const isToday = dayKey === today && !isArchiveView;
          const isActive = activeDayKey === dayKey && !isArchiveView;
          return (
            <button
              key={dayKey}
              onClick={() => onDayClick(dayKey)}
              className={`
                w-full text-left px-3 py-2.5 rounded-lg text-base
                transition-colors duration-150
                flex items-center justify-between gap-2
                ${
                  isActive
                    ? "bg-orange-50 dark:bg-orange-950/40 text-orange-700 dark:text-orange-400 font-medium"
                    : isToday && !activeDayKey
                      ? "bg-orange-50 dark:bg-orange-950/40 text-orange-700 dark:text-orange-400 font-medium"
                      : "text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800"
                }
              `}
            >
              <span className="truncate">
                {formatDayKey(dayKey)}
              </span>
              <span className="flex items-center gap-1.5">
                {count > 0 && (
                  <span
                    className={`
                      w-1.5 h-1.5 rounded-full
                      ${isActive || (isToday && !activeDayKey) ? "bg-orange-400" : "bg-gray-300 dark:bg-gray-600"}
                    `}
                  />
                )}
                <span className={`text-xs ${isActive || (isToday && !activeDayKey) ? "text-orange-500 dark:text-orange-400" : "text-gray-400 dark:text-gray-500"}`}>{count}</span>
              </span>
            </button>
          );
        })
      )}
    </nav>
  );
});
