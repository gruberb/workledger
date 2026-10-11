import { useEffect, useState, useSyncExternalStore } from "react";
import { SyncEngine } from "../engine/sync-engine.ts";
import { idbSyncStorage } from "../storage/sync-settings.ts";
import { httpSyncApi } from "../utils/sync-api.ts";
import { onEntryChanged, onEntryDeleted } from "../utils/sync-events.ts";
import { applyRemoteEntries, getAllEntries, getEntry, useEntriesActions } from "../../entries/index.ts";

function createEngine(): SyncEngine {
  return new SyncEngine({
    api: httpSyncApi,
    storage: idbSyncStorage,
    entries: { getAllEntries, getEntry, applyRemoteEntries },
    isVisible: () => document.visibilityState === "visible",
  });
}

export function useSync() {
  const { refresh } = useEntriesActions();
  const [engine] = useState(createEngine);
  const { config, status, remoteRevision } = useSyncExternalStore(engine.subscribe, engine.getState);

  useEffect(() => {
    void engine.start();
    const unsubChanged = onEntryChanged(engine.notifyChanged);
    const unsubDeleted = onEntryDeleted(engine.notifyDeleted);
    const handleVisibility = () => {
      if (document.visibilityState === "visible") engine.onVisible();
    };
    document.addEventListener("visibilitychange", handleVisibility);
    return () => {
      engine.stop();
      unsubChanged();
      unsubDeleted();
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [engine]);

  useEffect(() => {
    if (remoteRevision === 0) return;
    // refresh() also reloads the archive when it is loaded.
    void refresh();
  }, [remoteRevision, refresh]);

  return {
    config,
    status,
    generateSyncId: engine.generateSyncId,
    connect: engine.connect,
    disconnect: engine.disconnect,
    deleteAccount: engine.deleteAccount,
    setMode: engine.setMode,
    setServerUrl: engine.setServerUrl,
    syncNow: engine.syncNow,
  };
}
