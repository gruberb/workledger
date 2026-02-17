import { memo, useMemo } from "react";
import { format } from "date-fns";

interface SidebarWeekListProps {
  dayKeys: string[];
  entriesByDay: Map<string, unknown[]>;
}

interface WeekSummary {
  weekKey: string;
  label: string;
  entryCount: number;
}

function getISOWeekKey(dayKey: string): string {
  const date = new Date(dayKey + "T00:00:00");
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(weekNo).padStart(2, "0")}`;
}

function getMondayOfISOWeek(weekKey: string): Date {
  const [yearStr, weekStr] = weekKey.split("-W");
  const year = parseInt(yearStr, 10);
  const week = parseInt(weekStr, 10);
  const jan4 = new Date(Date.UTC(year, 0, 4));
  const jan4Day = jan4.getUTCDay() || 7;
  const mondayWeek1 = new Date(jan4);
  mondayWeek1.setUTCDate(jan4.getUTCDate() - jan4Day + 1);
  const monday = new Date(mondayWeek1);
  monday.setUTCDate(mondayWeek1.getUTCDate() + (week - 1) * 7);
  return monday;
}

function getCurrentISOWeekKey(): string {
  const now = new Date();
  const dayKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  return getISOWeekKey(dayKey);
}

function getPreviousWeekKey(weekKey: string): string {
  const monday = getMondayOfISOWeek(weekKey);
  monday.setUTCDate(monday.getUTCDate() - 7);
  const dayKey = `${monday.getUTCFullYear()}-${String(monday.getUTCMonth() + 1).padStart(2, "0")}-${String(monday.getUTCDate()).padStart(2, "0")}`;
  return getISOWeekKey(dayKey);
}

function formatWeekLabel(weekKey: string): string {
  const currentWeek = getCurrentISOWeekKey();
  if (weekKey === currentWeek) return "This Week";
  const lastWeek = getPreviousWeekKey(currentWeek);
  if (weekKey === lastWeek) return "Last Week";
  const monday = getMondayOfISOWeek(weekKey);
  return `Week of ${format(monday, "MMM d")}`;
}

export const SidebarWeekList = memo(function SidebarWeekList({ dayKeys, entriesByDay }: SidebarWeekListProps) {
  const weeks = useMemo<WeekSummary[]>(() => {
    const weekMap = new Map<string, number>();
    for (const dayKey of dayKeys) {
      const weekKey = getISOWeekKey(dayKey);
      const count = entriesByDay.get(dayKey)?.length ?? 0;
      weekMap.set(weekKey, (weekMap.get(weekKey) ?? 0) + count);
    }
    return [...weekMap.entries()]
      .sort(([a], [b]) => b.localeCompare(a))
      .map(([weekKey, entryCount]) => ({
        weekKey,
        label: formatWeekLabel(weekKey),
        entryCount,
      }));
  }, [dayKeys, entriesByDay]);

  if (weeks.length === 0) {
    return (
      <nav className="flex-1 overflow-y-auto -mx-2 min-h-0">
        <p className="text-sm text-gray-400 px-2">No entries to review</p>
      </nav>
    );
  }

  return (
    <nav className="flex-1 overflow-y-auto -mx-2 min-h-0">
      <p className="text-[11px] uppercase tracking-wider text-[var(--color-notebook-muted)] font-medium px-3 mb-2 flex items-center gap-2">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
          <line x1="16" y1="2" x2="16" y2="6" />
          <line x1="8" y1="2" x2="8" y2="6" />
          <line x1="3" y1="10" x2="21" y2="10" />
        </svg>
        Weeks
      </p>
      {weeks.map((week) => (
        <div
          key={week.weekKey}
          className="px-3 py-2 rounded-lg text-sm flex items-center justify-between gap-2 text-gray-600 dark:text-gray-400"
        >
          <span className="truncate">{week.label}</span>
          <span className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-gray-300 dark:bg-gray-600" />
            <span className="text-xs text-gray-400 dark:text-gray-500">
              {week.entryCount}
            </span>
          </span>
        </div>
      ))}
    </nav>
  );
});
