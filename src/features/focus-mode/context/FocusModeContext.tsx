import { createContext, useContext, useState, useCallback, useRef, useEffect, useLayoutEffect, useMemo, type ReactNode } from "react";
import type { WorkLedgerEntry } from "../../entries/index.ts";

interface FocusModeContextValue {
  focusedEntryId: string | null;
  handleFocusEntry: (entry: WorkLedgerEntry) => void;
  handleExitFocus: () => void;
}

const HISTORY_STATE = { workledgerFocus: true };

const FocusModeCtx = createContext<FocusModeContextValue | null>(null);

export function FocusModeProvider({ children }: { children: ReactNode }) {
  const [focusedEntryId, setFocusedEntryId] = useState<string | null>(null);
  const focusedEntryIdRef = useRef(focusedEntryId);
  useEffect(() => { focusedEntryIdRef.current = focusedEntryId; }, [focusedEntryId]);
  const scrollRestoreId = useRef<string | null>(null);

  const handleFocusEntry = useCallback((entry: WorkLedgerEntry) => {
    // Own history entry, so the browser or phone back button closes the entry
    // instead of leaving the app. Focusing another entry replaces it.
    const url = `#entry-${entry.id}`;
    if (focusedEntryIdRef.current) history.replaceState(HISTORY_STATE, "", url);
    else history.pushState(HISTORY_STATE, "", url);
    setFocusedEntryId(entry.id);
    window.scrollTo({ top: 0, behavior: "instant" });
  }, []);

  const handleExitFocus = useCallback(() => {
    scrollRestoreId.current = focusedEntryIdRef.current;
    setFocusedEntryId(null);
    // Pop our own entry so the stack stays clean; the URL goes back with it.
    if (history.state?.workledgerFocus) history.back();
    else history.replaceState(null, "", window.location.pathname + window.location.search);
  }, []);

  // Back (button or swipe) while an entry is focused closes it.
  useEffect(() => {
    const handlePopState = () => {
      if (!focusedEntryIdRef.current) return;
      scrollRestoreId.current = focusedEntryIdRef.current;
      setFocusedEntryId(null);
    };
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  // After exiting focus mode, scroll to the entry that was focused.
  // useLayoutEffect runs before the browser paints, preventing a visible
  // flash to the top of the page before the scroll correction.
  useLayoutEffect(() => {
    if (focusedEntryId === null && scrollRestoreId.current) {
      const entryId = scrollRestoreId.current;
      scrollRestoreId.current = null;
      const el = document.getElementById(`entry-${entryId}`);
      if (el) {
        el.scrollIntoView({ behavior: "instant", block: "start" });
      }
    }
  }, [focusedEntryId]);

  const value = useMemo(() => ({
    focusedEntryId,
    handleFocusEntry,
    handleExitFocus,
  }), [focusedEntryId, handleFocusEntry, handleExitFocus]);

  return (
    <FocusModeCtx.Provider value={value}>
      {children}
    </FocusModeCtx.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useFocusModeContext(): FocusModeContextValue {
  const ctx = useContext(FocusModeCtx);
  if (!ctx) throw new Error("useFocusModeContext must be used within FocusModeProvider");
  return ctx;
}
