import { format } from "date-fns";
import type { EntrySignifier, WorkLedgerEntry } from "../types/entry.ts";
import { formatDayKey } from "../../../utils/dates.ts";

export interface DayGroup {
  dayKey: string;
  dayLabel: string;
  entries: WorkLedgerEntry[];
}

export interface WeekGroup {
  weekKey: string;
  weekLabel: string;
  dateRange: string;
  days: DayGroup[];
  entryCount: number;
  topTags: [string, number][];
  signifierCounts: [EntrySignifier, number][];
}

function toDayKey(year: number, monthIndex: number, day: number): string {
  return `${year}-${String(monthIndex + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export function getISOWeekKey(dayKey: string): string {
  const [year, month, day] = dayKey.split("-").map(Number);
  const d = new Date(Date.UTC(year, month - 1, day));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(weekNo).padStart(2, "0")}`;
}

/** Monday of an ISO week as a day key (calendar math in UTC, no timezone shift). */
export function getMondayDayKey(weekKey: string): string {
  const [yearStr, weekStr] = weekKey.split("-W");
  const year = parseInt(yearStr, 10);
  const week = parseInt(weekStr, 10);
  const jan4 = new Date(Date.UTC(year, 0, 4));
  const jan4Day = jan4.getUTCDay() || 7;
  const monday = new Date(jan4);
  monday.setUTCDate(jan4.getUTCDate() - jan4Day + 1 + (week - 1) * 7);
  return toDayKey(monday.getUTCFullYear(), monday.getUTCMonth(), monday.getUTCDate());
}

function previousWeekKey(weekKey: string): string {
  const [year, month, day] = getMondayDayKey(weekKey).split("-").map(Number);
  const prev = new Date(Date.UTC(year, month - 1, day - 7));
  return getISOWeekKey(toDayKey(prev.getUTCFullYear(), prev.getUTCMonth(), prev.getUTCDate()));
}

/** Parses a day key as local midnight so date-fns formats the intended date. */
function localDate(dayKey: string): Date {
  const [year, month, day] = dayKey.split("-").map(Number);
  return new Date(year, month - 1, day);
}

export function formatWeekLabel(weekKey: string, todayKey: string): string {
  const currentWeek = getISOWeekKey(todayKey);
  if (weekKey === currentWeek) return "This Week";
  if (weekKey === previousWeekKey(currentWeek)) return "Last Week";
  return `Week of ${format(localDate(getMondayDayKey(weekKey)), "MMM d")}`;
}

function formatDateRange(dayKeys: string[]): string {
  const sorted = [...dayKeys].sort();
  if (sorted.length === 0) return "";
  if (sorted.length === 1) return formatDayKey(sorted[0]);
  return `${formatDayKey(sorted[0])} – ${formatDayKey(sorted[sorted.length - 1])}`;
}

export function groupByWeek(entriesByDay: Map<string, WorkLedgerEntry[]>, todayKey: string): WeekGroup[] {
  const weekMap = new Map<string, Map<string, WorkLedgerEntry[]>>();
  for (const [dayKey, entries] of entriesByDay) {
    const weekKey = getISOWeekKey(dayKey);
    if (!weekMap.has(weekKey)) weekMap.set(weekKey, new Map());
    weekMap.get(weekKey)!.set(dayKey, entries);
  }

  return [...weekMap.entries()]
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([weekKey, dayMap]) => {
      const tagCounts = new Map<string, number>();
      const sigCounts = new Map<EntrySignifier, number>();
      let entryCount = 0;

      const days: DayGroup[] = [...dayMap.entries()]
        .sort(([a], [b]) => b.localeCompare(a))
        .map(([dayKey, entries]) => {
          entryCount += entries.length;
          for (const entry of entries) {
            for (const tag of entry.tags ?? []) {
              tagCounts.set(tag, (tagCounts.get(tag) ?? 0) + 1);
            }
            if (entry.signifier) {
              sigCounts.set(entry.signifier, (sigCounts.get(entry.signifier) ?? 0) + 1);
            }
          }
          return {
            dayKey,
            dayLabel: format(localDate(dayKey), "EEEE, MMM d"),
            // Copy: the arrays belong to React state and must not be sorted in place.
            entries: [...entries].sort((a, b) => b.createdAt - a.createdAt),
          };
        });

      return {
        weekKey,
        weekLabel: formatWeekLabel(weekKey, todayKey),
        dateRange: formatDateRange([...dayMap.keys()]),
        days,
        entryCount,
        topTags: [...tagCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6),
        signifierCounts: [...sigCounts.entries()].sort((a, b) => b[1] - a[1]),
      };
    });
}
