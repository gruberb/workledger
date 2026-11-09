import { memo } from "react";
import { formatDayParts } from "../../utils/dates.ts";
import { useTodayKey } from "../../hooks/useTodayKey.ts";

interface DayHeaderProps {
  dayKey: string;
  entryCount: number;
}

/** The head of a day's sheet: name, date and entry count. Sticks while its page is in view. */
export const DayHeader = memo(function DayHeader({ dayKey, entryCount }: DayHeaderProps) {
  // Subscribing re-renders at midnight so "Today" / "Yesterday" stay correct.
  useTodayKey();
  const { name, detail } = formatDayParts(dayKey);
  return (
    <div className="day-head">
      <h2 className="text-[var(--color-notebook-text)] day-header-font">{name}</h2>
      <span className="day-head-detail truncate">{detail}</span>
      <span className="day-head-count">
        {entryCount} {entryCount === 1 ? "entry" : "entries"}
      </span>
    </div>
  );
});
