import {
  searchEntries,
  getRecentSearchEntries,
  getEntry,
  extractTitle,
} from "../../entries/index.ts";
import { formatDayKey, formatTime } from "../../../utils/dates.ts";
import type { DefaultReactSuggestionItem } from "@blocknote/react";

// Each candidate costs an IndexedDB read, and this runs per keystroke.
const DEFAULT_MAX_ITEMS = 30;

export async function getWikiLinkMenuItems(
  query: string,
  currentEntryId?: string,
  maxItems = DEFAULT_MAX_ITEMS,
): Promise<(DefaultReactSuggestionItem & { entryId: string; displayText: string })[]> {
  // Both sources are ordered most recently updated first; keep that order.
  const results = query.trim()
    ? await searchEntries(query)
    : await getRecentSearchEntries(maxItems + 1);

  const candidates = results.filter((r) => r.entryId !== currentEntryId).slice(0, maxItems);

  // Archiving removes the search row, but the index can briefly lag a
  // delete or archive, so confirm each entry still exists and is active.
  const verified = await Promise.all(
    candidates.map(async (r) => {
      const entry = await getEntry(r.entryId);
      if (!entry || entry.isArchived) return null;
      return { searchResult: r, entry };
    }),
  );

  return verified
    .filter((r): r is NonNullable<typeof r> => r !== null)
    .map(({ searchResult, entry }) => {
      const displayText = extractTitle(entry);
      const menuTitle = displayText.length > 60
        ? displayText.slice(0, 57) + "..."
        : displayText;
      return {
        title: menuTitle,
        subtext: `${formatDayKey(searchResult.dayKey)} at ${formatTime(entry.createdAt)}`,
        entryId: searchResult.entryId,
        displayText,
        onItemClick: () => {
          // handled by the SuggestionMenuController's onItemClick
        },
      };
    });
}
