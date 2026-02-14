import { useState, useEffect, useRef, useCallback } from "react";
import type { SyncConfig, SyncStatus, SyncEntry } from "../types/sync.ts";
import { DEFAULT_SYNC_CONFIG } from "../types/sync.ts";
import { loadSyncConfig, saveSyncConfig, clearSyncConfig } from "../storage/sync-settings.ts";
import { deriveKey, encrypt, decrypt, generateSyncIdLocal, computeAuthToken } from "../utils/crypto.ts";
import { computeIntegrityHash, verifyIntegrityHash } from "../utils/integrity.ts";
import {
  apiCreateAccount,
  apiValidateAccount,
  apiDeleteAccount,
  apiPushEntries,
  apiPullEntries,
  apiFullSync,
} from "../utils/sync-api.ts";
import { mergeRemoteEntries } from "../utils/merge.ts";
import { onEntryChanged, onEntryDeleted } from "../utils/sync-events.ts";
import { getAllEntries } from "../../entries/index.ts";
import { useEntriesActions } from "../../entries/index.ts";

const PULL_INTERVAL_MS = 30_000;
const PUSH_DEBOUNCE_MS = 2_000;

interface EntryPayload {
  dayKey: string;
  createdAt: number;
  updatedAt: number;
  blocks: unknown[];
  isArchived: boolean;
  tags: string[];
}

async function encryptEntry(
  key: CryptoKey,
  entry: { id: string; dayKey: string; createdAt: number; updatedAt: number; blocks: unknown[]; isArchived: boolean; tags: string[]; isDeleted?: boolean },
): Promise<SyncEntry> {
  const payload: EntryPayload = {
    dayKey: entry.dayKey,
    createdAt: entry.createdAt,
    updatedAt: entry.updatedAt,
    blocks: entry.blocks,
    isArchived: entry.isArchived,
    tags: entry.tags ?? [],
  };
  const plaintext = JSON.stringify(payload);
  const integrityHash = await computeIntegrityHash(payload);
  const encryptedPayload = await encrypt(key, plaintext);
  return {
    id: entry.id,
    updatedAt: entry.updatedAt,
    isArchived: entry.isArchived,
    isDeleted: entry.isDeleted ?? false,
    encryptedPayload,
    integrityHash,
  };
}

async function decryptEntry(
  key: CryptoKey,
  syncEntry: SyncEntry,
): Promise<{ id: string; dayKey: string; createdAt: number; updatedAt: number; blocks: unknown[]; isArchived: boolean; isDeleted: boolean; tags: string[] }> {
  if (syncEntry.isDeleted) {
    return {
      id: syncEntry.id,
      dayKey: "",
      createdAt: 0,
      updatedAt: syncEntry.updatedAt,
      blocks: [],
      isArchived: false,
      isDeleted: true,
      tags: [],
    };
  }
  const plaintext = await decrypt(key, syncEntry.encryptedPayload);
  const payload = JSON.parse(plaintext) as EntryPayload;
  const valid = await verifyIntegrityHash(payload, syncEntry.integrityHash);
  if (!valid) {
    console.warn(`Integrity hash mismatch for entry ${syncEntry.id}, skipping`);
    throw new Error(`Integrity hash mismatch for entry ${syncEntry.id}`);
  }
  return {
    id: syncEntry.id,
    dayKey: payload.dayKey,
    createdAt: payload.createdAt,
    updatedAt: payload.updatedAt,
    blocks: payload.blocks,
    isArchived: payload.isArchived,
    isDeleted: false,
    tags: payload.tags ?? [],
  };
}

export function useSync() {
  const [config, setConfig] = useState<SyncConfig>(DEFAULT_SYNC_CONFIG);
  const [status, setStatus] = useState<SyncStatus>({
    phase: "idle",
    error: null,
    lastSyncAt: null,
    pendingChanges: 0,
  });
  const [configLoaded, setConfigLoaded] = useState(false);

  const cryptoKeyRef = useRef<CryptoKey | null>(null);
  const authTokenRef = useRef<string | null>(null);
  const mutexRef = useRef(false);
  const pullIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pushTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dirtyEntriesRef = useRef<Set<string>>(new Set());
  const deletedEntriesRef = useRef<Set<string>>(new Set());
  const configRef = useRef(config);
  configRef.current = config;

  const { refresh } = useEntriesActions();

  // Load config on mount
  useEffect(() => {
    loadSyncConfig().then((loaded) => {
      setConfig(loaded);
      setStatus((s) => ({ ...s, lastSyncAt: loaded.lastSyncAt }));
      setConfigLoaded(true);
    });
  }, []);

  // Derive key and auth token, start intervals when config changes to remote mode
  useEffect(() => {
    if (!configLoaded) return;
    if (config.mode !== "remote" || !config.syncId || !config.salt) {
      cryptoKeyRef.current = null;
      authTokenRef.current = null;
      stopIntervals();
      return;
    }

    let cancelled = false;
    Promise.all([
      deriveKey(config.syncId, config.salt),
      computeAuthToken(config.syncId),
    ]).then(([key, token]) => {
      if (cancelled) return;
      cryptoKeyRef.current = key;
      authTokenRef.current = token;
      startPullInterval();
    });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [configLoaded, config.mode, config.syncId, config.salt]);

  // Listen for entry change/delete events
  useEffect(() => {
    if (config.mode !== "remote") return;
    const unsub1 = onEntryChanged((entryId) => {
      dirtyEntriesRef.current.add(entryId);
      setStatus((s) => ({ ...s, pendingChanges: dirtyEntriesRef.current.size }));
      schedulePush();
    });
    const unsub2 = onEntryDeleted((entryId) => {
      dirtyEntriesRef.current.add(entryId);
      deletedEntriesRef.current.add(entryId);
      setStatus((s) => ({ ...s, pendingChanges: dirtyEntriesRef.current.size }));
      schedulePush();
    });
    return () => { unsub1(); unsub2(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config.mode]);

  // Visibility change: pull immediately on tab focus
  useEffect(() => {
    if (config.mode !== "remote") return;
    const handler = () => {
      if (document.visibilityState === "visible" && cryptoKeyRef.current) {
        pull();
      }
    };
    document.addEventListener("visibilitychange", handler);
    return () => document.removeEventListener("visibilitychange", handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config.mode]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopIntervals();
      if (pushTimeoutRef.current) clearTimeout(pushTimeoutRef.current);
    };
  }, []);

  function startPullInterval() {
    stopIntervals();
    pullIntervalRef.current = setInterval(() => {
      if (document.visibilityState === "visible") {
        pull();
      }
    }, PULL_INTERVAL_MS);
  }

  function stopIntervals() {
    if (pullIntervalRef.current) {
      clearInterval(pullIntervalRef.current);
      pullIntervalRef.current = null;
    }
  }

  function schedulePush() {
    if (pushTimeoutRef.current) clearTimeout(pushTimeoutRef.current);
    pushTimeoutRef.current = setTimeout(() => push(), PUSH_DEBOUNCE_MS);
  }

  async function push(forceAll = false) {
    const key = cryptoKeyRef.current;
    const token = authTokenRef.current;
    const cfg = configRef.current;
    if (!key || !token || cfg.mode !== "remote") return;
    if (mutexRef.current) {
      // Retry push after current operation finishes
      schedulePush();
      return;
    }
    mutexRef.current = true;

    try {
      setStatus((s) => ({ ...s, phase: "pushing" }));

      const allEntries = await getAllEntries();
      const dirtyIds = dirtyEntriesRef.current;
      const toPush = forceAll
        ? allEntries
        : dirtyIds.size > 0
          ? allEntries.filter((e) => dirtyIds.has(e.id))
          : allEntries.filter((e) => cfg.lastSyncAt === null || e.updatedAt > cfg.lastSyncAt);

      // Build deletion markers for entries removed from IDB
      const now = Date.now();
      const deletionMarkers: SyncEntry[] = [];
      for (const entryId of deletedEntriesRef.current) {
        deletionMarkers.push({
          id: entryId,
          updatedAt: now,
          isArchived: false,
          isDeleted: true,
          encryptedPayload: "",
          integrityHash: "",
        });
      }

      const encrypted: SyncEntry[] = await Promise.all(
        toPush.map((e) => encryptEntry(key, e)),
      );

      const allToPush = [...encrypted, ...deletionMarkers];

      if (allToPush.length === 0) {
        setStatus((s) => ({ ...s, phase: "idle" }));
        mutexRef.current = false;
        return;
      }

      const res = await apiPushEntries(token, allToPush, cfg.serverUrl);

      const pushNow = Date.now();
      const updated: SyncConfig = {
        ...cfg,
        lastSyncSeq: res.serverSeq,
        lastSyncAt: pushNow,
      };
      await saveSyncConfig(updated);
      setConfig(updated);
      dirtyEntriesRef.current.clear();
      deletedEntriesRef.current.clear();
      setStatus({ phase: "idle", error: null, lastSyncAt: pushNow, pendingChanges: 0 });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Push failed";
      setStatus((s) => ({ ...s, phase: "error", error: msg }));
    } finally {
      mutexRef.current = false;
    }
  }

  async function pull() {
    const key = cryptoKeyRef.current;
    const token = authTokenRef.current;
    const cfg = configRef.current;
    if (!key || !token || cfg.mode !== "remote") return;
    if (mutexRef.current) return;
    mutexRef.current = true;

    try {
      setStatus((s) => ({ ...s, phase: "pulling" }));

      let since = cfg.lastSyncSeq;
      let hasMore = true;
      let totalMerged = 0;

      while (hasMore) {
        const res = await apiPullEntries(token, since, 100, cfg.serverUrl);
        hasMore = res.hasMore;

        if (res.entries.length > 0) {
          setStatus((s) => ({ ...s, phase: "merging" }));
          const decrypted = [];
          for (const entry of res.entries) {
            try {
              decrypted.push(await decryptEntry(key, entry));
            } catch {
              // Skip entries with integrity errors
            }
          }

          const merged = await mergeRemoteEntries(decrypted);
          totalMerged += merged;

          const lastEntry = res.entries[res.entries.length - 1];
          if (lastEntry.serverSeq !== undefined && lastEntry.serverSeq > since) {
            since = lastEntry.serverSeq;
          }
        }

        if (res.serverSeq > since) {
          since = res.serverSeq;
        }
      }

      if (totalMerged > 0) {
        await refresh();
      }

      const now = Date.now();
      const updated: SyncConfig = { ...cfg, lastSyncSeq: since, lastSyncAt: now };
      await saveSyncConfig(updated);
      setConfig(updated);
      setStatus((s) => ({ ...s, phase: "idle", error: null, lastSyncAt: now }));
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Pull failed";
      setStatus((s) => ({ ...s, phase: "error", error: msg }));
    } finally {
      mutexRef.current = false;
    }
  }

  const generateSyncId = useCallback(async () => {
    try {
      setStatus((s) => ({ ...s, phase: "pulling", error: null }));
      const cfg = configRef.current;
      const syncId = generateSyncIdLocal();
      const authToken = await computeAuthToken(syncId);
      const { salt } = await apiCreateAccount(authToken, cfg.serverUrl);

      const key = await deriveKey(syncId, salt);
      cryptoKeyRef.current = key;
      authTokenRef.current = authToken;

      const newConfig: SyncConfig = {
        mode: "remote",
        syncId,
        salt,
        serverUrl: cfg.serverUrl,
        lastSyncSeq: 0,
        lastSyncAt: null,
      };
      await saveSyncConfig(newConfig);
      setConfig(newConfig);
      setStatus((s) => ({ ...s, phase: "idle", error: null }));
      return syncId;
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to create account";
      setStatus((s) => ({ ...s, phase: "error", error: msg }));
      return null;
    }
  }, []);

  const connect = useCallback(async (syncId: string) => {
    try {
      setStatus((s) => ({ ...s, phase: "pulling", error: null }));
      const cfg = configRef.current;

      const authToken = await computeAuthToken(syncId);
      const validateRes = await apiValidateAccount(authToken, cfg.serverUrl);
      if (!validateRes.valid) {
        setStatus((s) => ({ ...s, phase: "error", error: "Invalid sync ID" }));
        return false;
      }

      const key = await deriveKey(syncId, validateRes.salt);
      cryptoKeyRef.current = key;
      authTokenRef.current = authToken;

      // Full sync: encrypt all local entries and send
      const localEntries = await getAllEntries();
      const encrypted = await Promise.all(
        localEntries.map((e) => encryptEntry(key, e)),
      );

      const fullRes = await apiFullSync(authToken, encrypted, cfg.serverUrl);

      // Decrypt and merge server entries
      const decrypted = [];
      for (const entry of fullRes.entries) {
        try {
          decrypted.push(await decryptEntry(key, entry));
        } catch {
          // Skip entries with integrity errors
        }
      }
      await mergeRemoteEntries(decrypted);
      await refresh();

      const now = Date.now();
      const newConfig: SyncConfig = {
        mode: "remote",
        syncId,
        salt: validateRes.salt,
        serverUrl: cfg.serverUrl,
        lastSyncSeq: fullRes.serverSeq,
        lastSyncAt: now,
      };
      await saveSyncConfig(newConfig);
      setConfig(newConfig);
      setStatus({ phase: "idle", error: null, lastSyncAt: now, pendingChanges: 0 });
      startPullInterval();
      return true;
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Connection failed";
      setStatus((s) => ({ ...s, phase: "error", error: msg }));
      return false;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refresh]);

  const disconnect = useCallback(async () => {
    stopIntervals();
    if (pushTimeoutRef.current) clearTimeout(pushTimeoutRef.current);
    cryptoKeyRef.current = null;
    authTokenRef.current = null;
    dirtyEntriesRef.current.clear();

    const newConfig: SyncConfig = { ...DEFAULT_SYNC_CONFIG };
    await clearSyncConfig();
    setConfig(newConfig);
    setStatus({ phase: "idle", error: null, lastSyncAt: null, pendingChanges: 0 });
  }, []);

  const deleteAccount = useCallback(async () => {
    const token = authTokenRef.current;
    if (token) {
      try {
        await apiDeleteAccount(token, configRef.current.serverUrl);
      } catch {
        // Server delete failed — still disconnect locally
      }
    }
    await disconnect();
  }, [disconnect]);

  const setMode = useCallback(async (mode: "local" | "remote") => {
    if (mode === "local") {
      // Stop active syncing but keep syncId/salt so switching back reconnects
      stopIntervals();
      if (pushTimeoutRef.current) clearTimeout(pushTimeoutRef.current);
      dirtyEntriesRef.current.clear();
    }
    const updated: SyncConfig = { ...configRef.current, mode };
    await saveSyncConfig(updated);
    setConfig(updated);
  }, []);

  const setServerUrl = useCallback(async (url: string | null) => {
    const updated: SyncConfig = { ...configRef.current, serverUrl: url || null };
    configRef.current = updated;
    await saveSyncConfig(updated);
    setConfig(updated);
  }, []);

  const syncNow = useCallback(async () => {
    await push(true);
    await pull();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return {
    config,
    status,
    generateSyncId,
    connect,
    disconnect,
    deleteAccount,
    setMode,
    setServerUrl,
    syncNow,
  };
}
