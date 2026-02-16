import { useState, useEffect, useRef, useCallback } from "react";
import type { SyncConfig, SyncStatus } from "../types/sync.ts";
import { DEFAULT_SYNC_CONFIG } from "../types/sync.ts";
import { loadSyncConfig, saveSyncConfig, clearSyncConfig } from "../storage/sync-settings.ts";
import { deriveKey, generateSyncIdLocal, computeAuthToken } from "../utils/crypto.ts";
import { apiCreateAccount, apiValidateAccount, apiDeleteAccount, apiFullSync } from "../utils/sync-api.ts";
import { encryptEntry, decryptEntry } from "../utils/sync-crypto.ts";
import { mergeRemoteEntries } from "../utils/merge.ts";
import { pushEntries, pullEntries } from "../utils/sync-operations.ts";
import { onEntryChanged, onEntryDeleted } from "../utils/sync-events.ts";
import { getAllEntries } from "../../entries/index.ts";
import { useEntriesActions } from "../../entries/index.ts";

const PULL_INTERVAL_MS = 30_000 as const;
const PUSH_DEBOUNCE_MS = 2_000 as const;
const PUSH_RETRY_DELAYS = [5_000, 15_000, 30_000, 60_000] as const;

function isRetryableError(err: unknown): boolean {
  if (!(err instanceof Error)) return true;
  const msg = err.message;
  // Retry on network errors and 5xx server errors; don't retry 4xx client errors
  if (msg.includes("Sync server error 4")) return false;
  return true;
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
  const pushRetryCountRef = useRef(0);
  const pushRetryTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const configRef = useRef(config);
  configRef.current = config;

  const { refresh } = useEntriesActions();

  // --- Interval helpers ---

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
    if (pushRetryTimeoutRef.current) clearTimeout(pushRetryTimeoutRef.current);
    pushRetryCountRef.current = 0;
    pushTimeoutRef.current = setTimeout(() => push(), PUSH_DEBOUNCE_MS);
  }

  // --- Config loading ---

  useEffect(() => {
    loadSyncConfig().then((loaded) => {
      setConfig(loaded);
      setStatus((s) => ({ ...s, lastSyncAt: loaded.lastSyncAt }));
      setConfigLoaded(true);
    });
  }, []);

  // --- Key derivation & interval start ---

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
      pull();
      startPullInterval();
    });

    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [configLoaded, config.mode, config.syncId, config.salt]);

  // --- Event listeners ---

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

  // --- Visibility change: pull on tab focus ---

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

  // --- Cleanup ---

  useEffect(() => {
    return () => {
      stopIntervals();
      if (pushTimeoutRef.current) clearTimeout(pushTimeoutRef.current);
      if (pushRetryTimeoutRef.current) clearTimeout(pushRetryTimeoutRef.current);
    };
  }, []);

  // --- Push & Pull ---

  async function push(forceAll = false) {
    const key = cryptoKeyRef.current;
    const token = authTokenRef.current;
    const cfg = configRef.current;
    if (!key || !token || cfg.mode !== "remote") return;
    if (mutexRef.current) {
      schedulePush();
      return;
    }
    mutexRef.current = true;

    try {
      setStatus((s) => ({ ...s, phase: "pushing" }));
      const result = await pushEntries({
        key, token, config: cfg,
        dirtyIds: dirtyEntriesRef.current,
        deletedIds: deletedEntriesRef.current,
        forceAll,
      });

      if (!result) {
        setStatus((s) => ({ ...s, phase: "idle" }));
        return;
      }

      // Only update lastSyncAt — only pull should advance lastSyncSeq.
      // Re-read configRef to pick up any lastSyncSeq change from a preceding pull().
      const updated: SyncConfig = { ...configRef.current, lastSyncAt: result.syncedAt };
      configRef.current = updated;
      await saveSyncConfig(updated);
      setConfig(updated);
      dirtyEntriesRef.current.clear();
      deletedEntriesRef.current.clear();
      pushRetryCountRef.current = 0;
      setStatus({ phase: "idle", error: null, lastSyncAt: result.syncedAt, pendingChanges: 0 });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Push failed";
      setStatus((s) => ({ ...s, phase: "error", error: msg }));

      if (isRetryableError(err) && pushRetryCountRef.current < PUSH_RETRY_DELAYS.length) {
        const delay = PUSH_RETRY_DELAYS[pushRetryCountRef.current];
        pushRetryCountRef.current++;
        if (pushRetryTimeoutRef.current) clearTimeout(pushRetryTimeoutRef.current);
        pushRetryTimeoutRef.current = setTimeout(() => push(forceAll), delay);
      }
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
      const result = await pullEntries({
        key, token, config: cfg,
        onPhaseChange: (phase) => setStatus((s) => ({ ...s, phase: phase as SyncStatus["phase"] })),
      });

      if (result.hadEntries) {
        await refresh();
      }

      const updated: SyncConfig = { ...cfg, lastSyncSeq: result.serverSeq, lastSyncAt: result.syncedAt };
      configRef.current = updated;
      await saveSyncConfig(updated);
      setConfig(updated);
      setStatus((s) => ({ ...s, phase: "idle", error: null, lastSyncAt: result.syncedAt }));
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Pull failed";
      setStatus((s) => ({ ...s, phase: "error", error: msg }));
    } finally {
      mutexRef.current = false;
    }
  }

  // --- Account management ---

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
        } catch (err) {
          console.warn(`[sync] Failed to decrypt entry ${entry.id} during full sync:`, err instanceof Error ? err.message : err);
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
    if (pushRetryTimeoutRef.current) clearTimeout(pushRetryTimeoutRef.current);
    pushRetryCountRef.current = 0;
    cryptoKeyRef.current = null;
    authTokenRef.current = null;
    dirtyEntriesRef.current.clear();
    deletedEntriesRef.current.clear();

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
      stopIntervals();
      if (pushTimeoutRef.current) clearTimeout(pushTimeoutRef.current);
      if (pushRetryTimeoutRef.current) clearTimeout(pushRetryTimeoutRef.current);
      pushRetryCountRef.current = 0;
      dirtyEntriesRef.current.clear();
      deletedEntriesRef.current.clear();
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
    // Reset cursor to force a full re-pull, recovering any entries
    // that were skipped by previous cursor-advancement bugs
    const cfg = configRef.current;
    if (cfg.lastSyncSeq > 0) {
      const reset: SyncConfig = { ...cfg, lastSyncSeq: 0 };
      configRef.current = reset;
      await saveSyncConfig(reset);
      setConfig(reset);
    }
    await pull();
    await push(true);
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
