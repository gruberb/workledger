import { useEffect, useCallback } from "react";
import { useEntriesData, useEntriesActions } from "../context/EntriesContext.tsx";
import { useSidebarContext } from "../../sidebar/context/SidebarContext.tsx";

export function useEntryNavigation() {
  const { entriesByDay } = useEntriesData();
  const { loadEntryById } = useEntriesActions();
  const { setActiveDayKey } = useSidebarContext();

  const navigateToEntry = useCallback(
    async (entryId: string) => {
      const scrollAndHighlight = (el: HTMLElement) => {
        el.scrollIntoView({ behavior: "smooth", block: "start" });
        el.classList.add("entry-link-highlight");
        setTimeout(() => el.classList.remove("entry-link-highlight"), 2000);
        setTimeout(() => {
          const editorEl = el.querySelector<HTMLElement>("[contenteditable=true]");
          if (editorEl) editorEl.focus();
        }, 400);
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
    setActiveDayKey(dayKey);
    const el = document.getElementById(`day-${dayKey}`);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [setActiveDayKey]);

  // Custom event listener for wiki links
  useEffect(() => {
    const handler = (e: Event) => {
      const entryId = (e as CustomEvent).detail?.entryId;
      if (entryId) navigateToEntry(entryId);
    };
    window.addEventListener("workledger:navigate-entry", handler);
    return () => window.removeEventListener("workledger:navigate-entry", handler);
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

  return { navigateToEntry, handleSearchResultClick, handleDayClick };
}
