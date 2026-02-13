import { useEffect, useCallback } from "react";
import { useEntriesActions } from "../features/entries/context/EntriesContext.tsx";
import { useSidebarContext } from "../features/sidebar/context/SidebarContext.tsx";
import { useFocusModeContext } from "../features/focus-mode/context/FocusModeContext.tsx";
import { useAIContext } from "../features/ai/context/AIContext.tsx";
import { useSearch } from "../features/search/hooks/useSearch.ts";

export function useKeyboardShortcuts() {
  const { createEntry } = useEntriesActions();
  const { archiveView, hasActiveFilters, clearAllFilters, toggleSidebar } = useSidebarContext();
  const { focusedEntryId, handleExitFocus } = useFocusModeContext();
  const { settings: aiSettings, handleToggleAISidebar } = useAIContext();
  const { isOpen: searchOpen, open: openSearch, close: closeSearch } = useSearch();

  const handleNewEntry = useCallback(async () => {
    const entry = await createEntry();
    setTimeout(() => {
      document.getElementById(`entry-${entry.id}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 100);
  }, [createEntry]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "j") {
        e.preventDefault();
        if (!archiveView) handleNewEntry();
      }
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        if (searchOpen) {
          closeSearch();
        } else {
          openSearch();
        }
      }
      if ((e.metaKey || e.ctrlKey) && e.key === "\\") {
        e.preventDefault();
        toggleSidebar();
      }
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && (e.key === "i" || e.key === "I")) {
        e.preventDefault();
        if (aiSettings.enabled) {
          handleToggleAISidebar();
        }
      }
      if (e.key === "Escape" && focusedEntryId) {
        handleExitFocus();
      } else if (e.key === "Escape" && hasActiveFilters) {
        clearAllFilters();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [handleNewEntry, searchOpen, closeSearch, openSearch, hasActiveFilters, archiveView, aiSettings.enabled, handleToggleAISidebar, focusedEntryId, handleExitFocus, toggleSidebar, clearAllFilters]);

  return { handleNewEntry };
}
