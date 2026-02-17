import type { WorkLedgerEntry } from "../../entries/index.ts";

/**
 * Filters a Map of entries by selected tags (AND, exact match), text query
 * (tag substring match + a custom text matcher for entry content), and
 * selected signifiers (OR — entry must have any of the selected signifiers).
 *
 * The `textMatcher` callback determines how entry body text is matched:
 * - For active entries: checks against the search index (filteredEntryIds set)
 * - For archived entries: does in-memory extractTextFromBlocks matching
 */
export function filterEntries(
  entriesByDay: Map<string, WorkLedgerEntry[]>,
  selectedTags: string[],
  textQuery: string,
  textMatcher: (entry: WorkLedgerEntry) => boolean,
  selectedSignifiers?: string[],
): Map<string, WorkLedgerEntry[]> {
  const hasTagFilter = selectedTags.length > 0;
  const hasTextFilter = textQuery.trim() !== "";
  const hasSignifierFilter = (selectedSignifiers?.length ?? 0) > 0;
  if (!hasTagFilter && !hasTextFilter && !hasSignifierFilter) return entriesByDay;

  const textLower = textQuery.trim().toLowerCase();
  const filtered = new Map<string, WorkLedgerEntry[]>();

  for (const [dayKey, entries] of entriesByDay) {
    const matching = entries.filter((e) => {
      // Tag filter: entry must have every selected tag (exact match, AND logic)
      if (hasTagFilter) {
        const entryTags = e.tags ?? [];
        if (!selectedTags.every((st) => entryTags.includes(st))) return false;
      }
      // Signifier filter: entry must have one of the selected signifiers (OR logic)
      if (hasSignifierFilter) {
        if (!e.signifier || !selectedSignifiers!.includes(e.signifier)) return false;
      }
      // Text filter: tag substring match + custom text matcher
      if (hasTextFilter) {
        const tagMatch = e.tags?.some((t) => t.toLowerCase().includes(textLower));
        const contentMatch = textMatcher(e);
        if (!tagMatch && !contentMatch) return false;
      }
      return true;
    });
    if (matching.length > 0) {
      filtered.set(dayKey, matching);
    }
  }
  return filtered;
}
