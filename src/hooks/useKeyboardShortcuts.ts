import { useEffect, useCallback } from "react";
import { useEntriesActions } from "../features/entries/index.ts";
import { useSidebarUI, useSidebarFilter } from "../features/sidebar/index.ts";
import { useFocusModeContext } from "../features/focus-mode/index.ts";
import { useAIContext } from "../features/ai/index.ts";
import { scrollToEntry } from "../utils/scroll.ts";

interface SearchControls {
  isOpen: boolean;
  open: () => void;
  close: () => void;
}

export function useKeyboardShortcuts({ isOpen: searchOpen, open: openSearch, close: closeSearch }: SearchControls) {
  const { createEntry } = useEntriesActions();
  const { archiveView, toggleSidebar } = useSidebarUI();
  const { hasActiveFilters, clearAllFilters } = useSidebarFilter();
  const { focusedEntryId, handleExitFocus } = useFocusModeContext();
  const { settings: aiSettings, handleToggleAISidebar } = useAIContext();

  const handleNewEntry = useCallback(async () => {
    const entry = await createEntry();
    scrollToEntry(entry.id);
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
      if (e.key === "Escape") {
        // One press closes only the innermost thing. The search dialog, an editor
        // suggestion menu, or an input that handled the key (tag editor) owns it.
        const inputHandled = e.defaultPrevented && (e.target as HTMLElement | null)?.closest("input, textarea");
        if (searchOpen || escapeOwnedByMenu || inputHandled) return;
        if (focusedEntryId) {
          handleExitFocus();
        } else if (hasActiveFilters) {
          clearAllFilters();
        }
      }
    };

    // The editor closes its menu before the event bubbles here, so check in the
    // capture phase whether one was open.
    let escapeOwnedByMenu = false;
    const handleEscapeCapture = (e: KeyboardEvent) => {
      if (e.key === "Escape") escapeOwnedByMenu = !!document.querySelector(".bn-suggestion-menu");
    };

    document.addEventListener("keydown", handleKeyDown);
    document.addEventListener("keydown", handleEscapeCapture, true);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.removeEventListener("keydown", handleEscapeCapture, true);
    };
  }, [handleNewEntry, searchOpen, openSearch, closeSearch, hasActiveFilters, archiveView, aiSettings.enabled, handleToggleAISidebar, focusedEntryId, handleExitFocus, toggleSidebar, clearAllFilters]);

  return { handleNewEntry };
}
