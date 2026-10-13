import type { WorkLedgerEntry } from "../../entries/index.ts";

/** Filtered result per day array. Valid for one filter selection only. */
export type DayFilterCache = WeakMap<WorkLedgerEntry[], WorkLedgerEntry[]>;

/**
 * Filters a Map of entries by selected tags (AND, exact match) and selected
 * signifiers (OR: the entry must have one of them). Days left empty are dropped.
 *
 * Saving one entry replaces only its day's array, so with a `cache` (made for
 * this selection) only that day is filtered again and the others keep their
 * previous result, array identity included.
 */
export function filterEntries(
  entriesByDay: Map<string, WorkLedgerEntry[]>,
  selectedTags: string[],
  selectedSignifiers: string[],
  cache?: DayFilterCache,
): Map<string, WorkLedgerEntry[]> {
  if (selectedTags.length === 0 && selectedSignifiers.length === 0) return entriesByDay;

  const filtered = new Map<string, WorkLedgerEntry[]>();
  for (const [dayKey, entries] of entriesByDay) {
    let matching = cache?.get(entries);
    if (!matching) {
      matching = entries.filter((e) => {
        const entryTags = e.tags ?? [];
        if (!selectedTags.every((t) => entryTags.includes(t))) return false;
        if (selectedSignifiers.length > 0 && (!e.signifier || !selectedSignifiers.includes(e.signifier))) return false;
        return true;
      });
      cache?.set(entries, matching);
    }
    if (matching.length > 0) filtered.set(dayKey, matching);
  }
  return filtered;
}
