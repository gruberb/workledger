import { createContext, useContext, useMemo, type ReactNode } from "react";
import { useSync } from "../hooks/useSync.ts";
import type { SyncConfig, SyncStatus, SyncMode } from "../types/sync.ts";

interface SyncContextValue {
  config: SyncConfig;
  status: SyncStatus;
  generateSyncId: () => Promise<string | null>;
  connect: (syncId: string) => Promise<boolean>;
  disconnect: () => Promise<void>;
  /** False when the server delete failed; the account stays connected. */
  deleteAccount: () => Promise<boolean>;
  setMode: (mode: SyncMode) => Promise<void>;
  /** Resolves to an error message when the URL is rejected. */
  setServerUrl: (url: string | null) => Promise<string | null>;
  syncNow: () => Promise<void>;
}

const SyncContext = createContext<SyncContextValue | null>(null);

export function SyncProvider({ children }: { children: ReactNode }) {
  const { config, status, generateSyncId, connect, disconnect, deleteAccount, setMode, setServerUrl, syncNow } = useSync();
  const value = useMemo<SyncContextValue>(
    () => ({ config, status, generateSyncId, connect, disconnect, deleteAccount, setMode, setServerUrl, syncNow }),
    [config, status, generateSyncId, connect, disconnect, deleteAccount, setMode, setServerUrl, syncNow],
  );
  return <SyncContext.Provider value={value}>{children}</SyncContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useSyncContext(): SyncContextValue {
  const ctx = useContext(SyncContext);
  if (!ctx) throw new Error("useSyncContext must be used within SyncProvider");
  return ctx;
}
