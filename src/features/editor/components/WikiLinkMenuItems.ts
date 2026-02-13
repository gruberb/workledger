import {
  searchEntries,
  getRecentSearchEntries,
} from "../../entries/storage/search-index.ts";
import { getEntry } from "../../entries/storage/entries.ts";
import { formatDayKey, formatTime } from "../../entries/utils/dates.ts";
import { extractTitle } from "../../entries/utils/extract-title.ts";
import type { DefaultReactSuggestionItem } from "@blocknote/react";

export async function getWikiLinkMenuItems(
  query: string,
  currentEntryId?: string,
): Promise<(DefaultReactSuggestionItem & { entryId: string; displayText: string })[]> {
  const results = query.trim()
    ? await searchEntries(query)
    : await getRecentSearchEntries(100);

  const filtered = results.filter((r) => r.entryId !== currentEntryId);

  // Verify entries exist and are not archived, then extract titles
  const verified = await Promise.all(
    filtered.map(async (r) => {
      const entry = await getEntry(r.entryId);
      if (!entry || entry.isArchived) return null;
      return { searchResult: r, entry };
    }),
  );

  return verified
    .filter((r): r is NonNullable<typeof r> => r !== null)
    .sort((a, b) => b.entry.createdAt - a.entry.createdAt)
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
