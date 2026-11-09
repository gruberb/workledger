import { memo, type ReactNode } from "react";
import { formatDayParts } from "../../utils/dates.ts";
import { useTodayKey } from "../../hooks/useTodayKey.ts";

interface DayHeaderProps {
  dayKey: string;
  entryCount: number;
  /** Title of the entry being read, once its own title has scrolled under this head. */
  current?: string;
  /** A control at the right edge, e.g. open or fold the day's entries. */
  action?: ReactNode;
}

/** The head of a day's sheet: name, date (or the entry being read) and entry count. Sticks while its page is in view. */
export const DayHeader = memo(function DayHeader({ dayKey, entryCount, current, action }: DayHeaderProps) {
  // Subscribing re-renders at midnight so "Today" / "Yesterday" stay correct.
  useTodayKey();
  const { name, detail } = formatDayParts(dayKey);
  return (
    <div className="day-head">
      <h2 className="text-[var(--color-notebook-text)] day-header-font shrink-0">{name}</h2>
      {current ? (
        <span className="day-head-current truncate">{current}</span>
      ) : (
        <span className="day-head-detail truncate">{detail}</span>
      )}
      <span className="day-head-count">
        {entryCount} {entryCount === 1 ? "entry" : "entries"}
      </span>
      {action}
    </div>
  );
});
