import { createContext, useContext, useState, useCallback, type ReactNode } from "react";
import type { WorkLedgerEntry } from "../../entries/types/entry.ts";

interface FocusModeContextValue {
  focusedEntryId: string | null;
  handleFocusEntry: (entry: WorkLedgerEntry) => void;
  handleExitFocus: () => void;
}

const FocusModeCtx = createContext<FocusModeContextValue | null>(null);

export function FocusModeProvider({ children }: { children: ReactNode }) {
  const [focusedEntryId, setFocusedEntryId] = useState<string | null>(null);

  const handleFocusEntry = useCallback((entry: WorkLedgerEntry) => {
    setFocusedEntryId(entry.id);
    history.replaceState(null, "", `#entry-${entry.id}`);
  }, []);

  const handleExitFocus = useCallback(() => {
    setFocusedEntryId(null);
    history.replaceState(null, "", window.location.pathname);
  }, []);

  return (
    <FocusModeCtx.Provider value={{ focusedEntryId, handleFocusEntry, handleExitFocus }}>
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
