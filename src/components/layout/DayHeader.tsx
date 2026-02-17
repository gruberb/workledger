import { formatDayKey } from "../../utils/dates.ts";

interface DayHeaderProps {
  dayKey: string;
  entryCount: number;
}

export function DayHeader({ dayKey, entryCount }: DayHeaderProps) {
  return (
    <div className="day-header flex items-baseline gap-3 pt-6 max-sm:pt-14 pb-4 px-1 sticky top-0 sticky-header">
      <h2 className="text-gray-800 dark:text-gray-100 day-header-font">
        {formatDayKey(dayKey)}
      </h2>
      <span className="text-sm text-gray-400 dark:text-gray-500">
        {entryCount} {entryCount === 1 ? "entry" : "entries"}
      </span>
    </div>
  );
}
