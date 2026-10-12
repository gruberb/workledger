import type { WorkLedgerEntry } from "../../entries/index.ts";

/**
 * Filters a Map of entries by selected tags (AND, exact match) and selected
 * signifiers (OR: the entry must have one of them). Days left empty are dropped.
 */
export function filterEntries(
  entriesByDay: Map<string, WorkLedgerEntry[]>,
  selectedTags: string[],
  selectedSignifiers: string[],
): Map<string, WorkLedgerEntry[]> {
  if (selectedTags.length === 0 && selectedSignifiers.length === 0) return entriesByDay;

  const filtered = new Map<string, WorkLedgerEntry[]>();
  for (const [dayKey, entries] of entriesByDay) {
    const matching = entries.filter((e) => {
      const entryTags = e.tags ?? [];
      if (!selectedTags.every((t) => entryTags.includes(t))) return false;
      if (selectedSignifiers.length > 0 && (!e.signifier || !selectedSignifiers.includes(e.signifier))) return false;
      return true;
    });
    if (matching.length > 0) filtered.set(dayKey, matching);
  }
  return filtered;
}
