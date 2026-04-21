import { useEffect, useCallback, useRef } from "react";
import { useEntriesData, useEntriesActions } from "../context/EntriesContext.tsx";
import { useSidebarUI } from "../../sidebar/index.ts";
import { on } from "../../../utils/events.ts";

export function useEntryNavigation() {
  const { entriesByDay } = useEntriesData();
  const { loadEntryById } = useEntriesActions();
  const { setActiveDayKey } = useSidebarUI();
  const isManualScroll = useRef(false);

  const navigateToEntry = useCallback(
    async (entryId: string) => {
      const scrollAndHighlight = (el: HTMLElement) => {
        // Suppress IntersectionObserver during programmatic scroll
        isManualScroll.current = true;
        // Scroll to the first heading inside the editor if available,
        // so the user sees the entry title rather than the toolbar row.
        const heading = el.querySelector<HTMLElement>("[data-content-type='heading']");
        const scrollTarget = heading ?? el;
        scrollTarget.scrollIntoView({ behavior: "smooth", block: "start" });
        el.classList.add("entry-link-highlight");
        setTimeout(() => el.classList.remove("entry-link-highlight"), 2000);
        setTimeout(() => { isManualScroll.current = false; }, 800);
      };

      for (const [dayKey, entries] of entriesByDay) {
        if (entries.some((e) => e.id === entryId)) {
          setActiveDayKey(dayKey);
          break;
        }
      }

      history.replaceState(null, "", `#entry-${entryId}`);

      const existing = document.getElementById(`entry-${entryId}`);
      if (existing) {
        scrollAndHighlight(existing);
        return;
      }

      const entry = await loadEntryById(entryId);
      if (!entry) {
        console.warn(`Entry ${entryId} not found or archived`);
        return;
      }
      setActiveDayKey(entry.dayKey);

      setTimeout(() => {
        const el = document.getElementById(`entry-${entryId}`);
        if (el) scrollAndHighlight(el);
      }, 150);
    },
    [loadEntryById, entriesByDay, setActiveDayKey],
  );

  const handleSearchResultClick = useCallback((entryId: string) => {
    history.replaceState(null, "", `#entry-${entryId}`);
    const el = document.getElementById(`entry-${entryId}`);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, []);

  const handleDayClick = useCallback((dayKey: string) => {
    isManualScroll.current = true;
    setActiveDayKey(dayKey);
    const el = document.getElementById(`day-${dayKey}`);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
    } else {
      // Day section may not render when all its entries are pinned (they live
      // in the Pinned section at the top). Fall back to the first pinned
      // entry's card for that day.
      const pinnedForDay = entriesByDay.get(dayKey)?.find((e) => e.isPinned);
      if (pinnedForDay) {
        const entryEl = document.getElementById(`entry-${pinnedForDay.id}`);
        if (entryEl) entryEl.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    }
    // Re-enable observer after scroll settles
    setTimeout(() => { isManualScroll.current = false; }, 800);
  }, [setActiveDayKey, entriesByDay]);

  // Listen for wiki link navigation events
  useEffect(() => {
    return on("navigate-entry", ({ entryId }) => navigateToEntry(entryId));
  }, [navigateToEntry]);

  // Read URL hash on initial load
  useEffect(() => {
    const hash = window.location.hash;
    const match = hash.match(/^#entry-(.+)$/);
    if (match) {
      const entryId = match[1];
      requestAnimationFrame(() => navigateToEntry(entryId));
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps -- run once on mount

  // Listen for hashchange (browser back/forward)
  useEffect(() => {
    const handler = () => {
      const hash = window.location.hash;
      const match = hash.match(/^#entry-(.+)$/);
      if (match) {
        navigateToEntry(match[1]);
      }
    };
    window.addEventListener("hashchange", handler);
    return () => window.removeEventListener("hashchange", handler);
  }, [navigateToEntry]);

  // IntersectionObserver: auto-highlight the current day in the sidebar while scrolling
  useEffect(() => {
    const daySections = document.querySelectorAll<HTMLElement>("[id^='day-']");
    if (daySections.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (isManualScroll.current) return;
        // Find the topmost visible day section
        let topEntry: IntersectionObserverEntry | null = null;
        for (const entry of entries) {
          if (entry.isIntersecting) {
            if (!topEntry || entry.boundingClientRect.top < topEntry.boundingClientRect.top) {
              topEntry = entry;
            }
          }
        }
        if (topEntry) {
          const dayKey = topEntry.target.id.replace("day-", "");
          setActiveDayKey(dayKey);
        }
      },
      { rootMargin: "-10% 0px -70% 0px", threshold: 0 },
    );

    daySections.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [entriesByDay, setActiveDayKey]); // re-attach when entries change

  return { navigateToEntry, handleSearchResultClick, handleDayClick };
}
