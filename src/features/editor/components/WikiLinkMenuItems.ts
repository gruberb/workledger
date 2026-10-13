import {
  searchEntries,
  getRecentSearchEntries,
  getEntry,
  extractTitle,
} from "../../entries/index.ts";
import { formatDayKey, formatTime } from "../../../utils/dates.ts";
import type { DefaultReactSuggestionItem } from "@blocknote/react";

const DEFAULT_MAX_ITEMS = 30;
// Each query scans the whole search index, so wait for a pause in typing.
const DEFAULT_DEBOUNCE_MS = 150;

// Only one suggestion menu is open at a time, so one counter is enough to
// tell a superseded call from the latest one.
let latestCall = 0;

export async function getWikiLinkMenuItems(
  query: string,
  currentEntryId?: string,
  maxItems = DEFAULT_MAX_ITEMS,
  debounceMs = DEFAULT_DEBOUNCE_MS,
): Promise<(DefaultReactSuggestionItem & { entryId: string; displayText: string })[]> {
  const call = ++latestCall;
  // The menu ignores results of superseded queries, so an empty list is safe.
  // An empty query (menu just opened) answers immediately.
  if (query.trim() && debounceMs > 0) {
    await new Promise((resolve) => setTimeout(resolve, debounceMs));
    if (call !== latestCall) return [];
  }

  // Both sources are ordered most recently updated first; keep that order.
  const results = query.trim()
    ? await searchEntries(query)
    : await getRecentSearchEntries(maxItems + 1);

  // Search rows are removed on archive and delete, so they are trusted here.
  // Only rows indexed before titles were stored need the entry itself.
  const items = await Promise.all(
    results
      .filter((r) => r.entryId !== currentEntryId)
      .slice(0, maxItems)
      .map(async (r) => {
        if (r.title !== undefined && r.createdAt !== undefined) {
          return { entryId: r.entryId, dayKey: r.dayKey, displayText: r.title, createdAt: r.createdAt };
        }
        const entry = await getEntry(r.entryId);
        if (!entry || entry.isArchived) return null;
        return { entryId: r.entryId, dayKey: r.dayKey, displayText: extractTitle(entry), createdAt: entry.createdAt };
      }),
  );

  return items
    .filter((item): item is NonNullable<typeof item> => item !== null)
    .map(({ entryId, dayKey, displayText, createdAt }) => ({
      title: displayText.length > 60 ? displayText.slice(0, 57) + "..." : displayText,
      subtext: `${formatDayKey(dayKey)} at ${formatTime(createdAt)}`,
      entryId,
      displayText,
      onItemClick: () => {
        // handled by the SuggestionMenuController's onItemClick
      },
    }));
}
