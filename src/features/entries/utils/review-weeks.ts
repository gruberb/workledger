import { format } from "date-fns";
import type { EntrySignifier, WorkLedgerEntry } from "../types/entry.ts";
import { isoWeekDayKeys, isoWeekKey, mondayOfIsoWeek, previousIsoWeekKey } from "../../../utils/weeks.ts";

export interface DayGroup {
  dayKey: string;
  dayLabel: string;
  entries: WorkLedgerEntry[];
}

export interface WeekSummary {
  weekKey: string;
  label: string;
  /** Monday to Sunday of the week, e.g. "Oct 5 – Oct 11, 2026". */
  dateRange: string;
  /** Newest day first; only days with entries. */
  days: DayGroup[];
  entryCount: number;
  signifierCounts: [EntrySignifier, number][];
  /** Most used first. */
  tagCounts: [string, number][];
}

/** What the review list is narrowed to; `null` shows every entry. */
export type ReviewChip = { kind: "signifier"; value: EntrySignifier } | { kind: "tag"; value: string } | null;

/** Parses a day key as local midnight so date-fns formats the intended date. */
function localDate(dayKey: string): Date {
  const [year, month, day] = dayKey.split("-").map(Number);
  return new Date(year, month - 1, day);
}

export function formatWeekLabel(weekKey: string, todayKey: string): string {
  const currentWeek = isoWeekKey(todayKey);
  if (weekKey === currentWeek) return "This week";
  if (weekKey === previousIsoWeekKey(currentWeek)) return "Last week";
  return `Week of ${format(mondayOfIsoWeek(weekKey), "MMM d")}`;
}

function formatWeekRange(dayKeys: string[]): string {
  const first = localDate(dayKeys[0]);
  const last = localDate(dayKeys[dayKeys.length - 1]);
  return `${format(first, "MMM d")} – ${format(last, "MMM d, yyyy")}`;
}

/** Most used first; ties alphabetical so the chip order does not jump between renders. */
function countBy<K extends string>(keys: Iterable<K>): [K, number][] {
  const counts = new Map<K, number>();
  for (const key of keys) counts.set(key, (counts.get(key) ?? 0) + 1);
  return [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
}

/** Entries of one ISO week, grouped by day, with signifier and tag counts. */
export function summarizeWeek(entriesByDay: Map<string, WorkLedgerEntry[]>, weekKey: string, todayKey: string): WeekSummary {
  const weekDays = isoWeekDayKeys(weekKey);
  const days: DayGroup[] = [];
  for (const dayKey of [...weekDays].reverse()) {
    const entries = entriesByDay.get(dayKey);
    if (!entries?.length) continue;
    days.push({
      dayKey,
      dayLabel: format(localDate(dayKey), "EEEE, MMM d"),
      // Copy: the arrays belong to React state and must not be sorted in place.
      entries: [...entries].sort((a, b) => b.createdAt - a.createdAt),
    });
  }
  const all = days.flatMap((d) => d.entries);
  return {
    weekKey,
    label: formatWeekLabel(weekKey, todayKey),
    dateRange: formatWeekRange(weekDays),
    days,
    entryCount: all.length,
    signifierCounts: countBy(all.flatMap((e) => (e.signifier ? [e.signifier] : []))),
    tagCounts: countBy(all.flatMap((e) => e.tags ?? [])),
  };
}

export function matchesChip(entry: WorkLedgerEntry, chip: ReviewChip): boolean {
  if (!chip) return true;
  return chip.kind === "signifier" ? entry.signifier === chip.value : (entry.tags ?? []).includes(chip.value);
}

/** Days narrowed to the entries matching the chip; empty days are dropped. */
export function filterDays(days: DayGroup[], chip: ReviewChip): DayGroup[] {
  if (!chip) return days;
  return days
    .map((day) => ({ ...day, entries: day.entries.filter((e) => matchesChip(e, chip)) }))
    .filter((day) => day.entries.length > 0);
}
