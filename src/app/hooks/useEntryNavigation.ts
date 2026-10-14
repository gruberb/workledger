import { useEffect, useCallback, useRef } from "react";
import { useEntriesData, useEntriesActions } from "../../features/entries/index.ts";
import { useSidebarUI, useSetActiveDayKey } from "../../features/sidebar/index.ts";
import { useFocusModeContext } from "../../features/focus-mode/index.ts";
import { on } from "../../utils/events.ts";
import { waitForElement } from "../../utils/scroll.ts";

const SCROLL_SETTLE_MS = 800;

/**
 * Scrolling to entries and days, URL hash sync, and the sidebar's active-day
 * tracking. Lives in the app layer because it ties entries, sidebar and focus
 * mode together.
 *
 * @param visibleDayKeys day keys currently rendered in the stream (re-attaches the observer)
 */
export function useEntryNavigation(visibleDayKeys: string) {
  const { entriesByDay, loading } = useEntriesData();
  const { loadEntryById, loadDay } = useEntriesActions();
  const { archiveView, toggleArchiveView, reviewView, toggleReviewView } = useSidebarUI();
  const setActiveDayKey = useSetActiveDayKey();
  const { focusedEntryId, handleExitFocus } = useFocusModeContext();
  // Callbacks read the latest map through a ref: depending on it would hand the
  // sidebar and search new callbacks (and re-subscribe the listeners below) on
  // every save, since the map is replaced each time.
  const entriesByDayRef = useRef(entriesByDay);
  useEffect(() => {
    entriesByDayRef.current = entriesByDay;
  }, [entriesByDay]);
  const isManualScroll = useRef(false);

  const suppressObserver = useCallback(() => {
    isManualScroll.current = true;
    setTimeout(() => { isManualScroll.current = false; }, SCROLL_SETTLE_MS);
  }, []);

  const navigateToEntry = useCallback(
    async (entryId: string) => {
      history.replaceState(null, "", `#entry-${entryId}`);

      let dayKey: string | undefined;
      for (const [key, entries] of entriesByDayRef.current) {
        if (entries.some((e) => e.id === entryId)) {
          dayKey = key;
          break;
        }
      }
      if (!dayKey) {
        // Older than the loaded window: load its day first.
        const entry = await loadEntryById(entryId);
        if (!entry) {
          console.warn(`Entry ${entryId} not found or archived`);
          return;
        }
        dayKey = entry.dayKey;
      }
      setActiveDayKey(dayKey);

      const el = await waitForElement(`entry-${entryId}`);
      if (!el) return;
      suppressObserver();
      // Scroll to the first heading so the user sees the title, not the toolbar row.
      const heading = el.querySelector<HTMLElement>("[data-content-type='heading']");
      (heading ?? el).scrollIntoView({ behavior: "smooth", block: "start" });
      el.classList.add("entry-link-highlight");
      setTimeout(() => el.classList.remove("entry-link-highlight"), 2000);
    },
    [loadEntryById, setActiveDayKey, suppressObserver],
  );

  /**
   * Shows an entry from anywhere (search, weekly review). The target card is
   * hidden in focus mode and absent in the archive and review views, so leave
   * those first.
   */
  const revealEntry = useCallback(
    (entryId: string) => {
      if (focusedEntryId) handleExitFocus();
      if (archiveView) toggleArchiveView();
      if (reviewView) toggleReviewView();
      navigateToEntry(entryId);
    },
    [focusedEntryId, handleExitFocus, archiveView, toggleArchiveView, reviewView, toggleReviewView, navigateToEntry],
  );

  const handleDayClick = useCallback(async (dayKey: string) => {
    suppressObserver();
    setActiveDayKey(dayKey);
    // Sidebar lists every day, but only recent days are loaded.
    if (!archiveView && !entriesByDayRef.current.has(dayKey)) {
      await loadDay(dayKey);
    }
    const el = await waitForElement(`day-${dayKey}`, 300);
    if (el) {
      el.scrollIntoView({ behavior: "instant", block: "start" });
      return;
    }
    // No day section renders when all its entries are pinned (they live in the
    // Pinned section). Fall back to the first pinned entry's card for that day.
    const pinnedForDay = entriesByDayRef.current.get(dayKey)?.find((e) => e.isPinned);
    if (pinnedForDay) {
      document.getElementById(`entry-${pinnedForDay.id}`)?.scrollIntoView({ behavior: "instant", block: "start" });
    }
  }, [archiveView, loadDay, setActiveDayKey, suppressObserver]);

  // Wiki link and backlink navigation
  useEffect(() => {
    return on("navigate-entry", ({ entryId }) => revealEntry(entryId));
  }, [revealEntry]);

  // Deep link on initial load. Waits for the first load so the entry is not
  // overwritten by it and the stream exists to scroll in.
  const initialHashHandled = useRef(false);
  useEffect(() => {
    if (loading || initialHashHandled.current) return;
    initialHashHandled.current = true;
    const match = window.location.hash.match(/^#entry-(.+)$/);
    if (match) navigateToEntry(match[1]);
  }, [loading, navigateToEntry]);

  // Browser back/forward
  useEffect(() => {
    const handler = () => {
      const match = window.location.hash.match(/^#entry-(.+)$/);
      if (match) navigateToEntry(match[1]);
    };
    window.addEventListener("hashchange", handler);
    return () => window.removeEventListener("hashchange", handler);
  }, [navigateToEntry]);

  // Highlight the topmost visible day in the sidebar while scrolling. Keyed on
  // the rendered day list, not the entries map, which changes on every save.
  useEffect(() => {
    const daySections = document.querySelectorAll<HTMLElement>("[id^='day-']");
    if (daySections.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (isManualScroll.current) return;
        let topEntry: IntersectionObserverEntry | null = null;
        for (const entry of entries) {
          if (entry.isIntersecting) {
            if (!topEntry || entry.boundingClientRect.top < topEntry.boundingClientRect.top) {
              topEntry = entry;
            }
          }
        }
        if (topEntry) {
          setActiveDayKey(topEntry.target.id.replace("day-", ""));
        }
      },
      { rootMargin: "-10% 0px -70% 0px", threshold: 0 },
    );

    daySections.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [visibleDayKeys, setActiveDayKey]);

  return { revealEntry, handleDayClick };
}
