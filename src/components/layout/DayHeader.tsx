import { memo } from "react";
import { formatDayKey } from "../../utils/dates.ts";
import { useTodayKey } from "../../hooks/useTodayKey.ts";

interface DayHeaderProps {
  dayKey: string;
  entryCount: number;
}

export const DayHeader = memo(function DayHeader({ dayKey, entryCount }: DayHeaderProps) {
  // Subscribing re-renders at midnight so "Today" / "Yesterday" stay correct.
  useTodayKey();
  return (
    <div className="day-header flex items-baseline gap-3 pt-4 max-md:pt-3 pb-3 max-md:pb-1 px-1 sticky top-0 sticky-header">
      <h2 className="text-[var(--color-notebook-text)] day-header-font">
        {formatDayKey(dayKey)}
      </h2>
      <span className="text-sm text-[var(--color-notebook-muted)]">
        {entryCount} {entryCount === 1 ? "entry" : "entries"}
      </span>
    </div>
  );
});
