import type { SyncConfig, SyncMode, SyncStatus } from "../types/sync.ts";
import { DEFAULT_SYNC_CONFIG } from "../types/sync.ts";
import type { RemoteEntry, WorkLedgerEntry } from "../../entries/index.ts";
import type { SyncStorage } from "../storage/sync-settings.ts";
import { isRetryableError, SyncHttpError, type ApiContext, type SyncApi } from "../utils/sync-api.ts";
import { computeAuthToken, deriveKey, generateSyncIdLocal } from "../utils/crypto.ts";
import { pullEntries, pushEntries, type BatchLimits } from "../utils/sync-operations.ts";
import { validateServerUrl } from "../utils/server-url.ts";

export interface SyncOptions {
  pullIntervalMs: number;
  pushDebounceMs: number;
  retryDelaysMs: readonly number[];
  requestTimeoutMs: number;
  pullPageSize: number;
  batch: BatchLimits;
  /** Above this many dirty ids, one full read beats many single-entry reads. */
  bulkReadThreshold: number;
}

export const DEFAULT_SYNC_OPTIONS: SyncOptions = {
  pullIntervalMs: 30_000,
  pushDebounceMs: 2_000,
  retryDelaysMs: [5_000, 15_000, 30_000, 60_000],
  requestTimeoutMs: 30_000,
  pullPageSize: 100,
  // The reference server rejects request bodies over 1 MB.
  // The reference server caps each encryptedPayload at 700,000 chars.
  batch: { maxEntries: 100, maxBytes: 900_000, maxPayloadChars: 700_000 },
  bulkReadThreshold: 200,
};

export interface SyncEngineDeps {
  api: SyncApi;
  storage: SyncStorage;
  entries: {
    getAllEntries: () => Promise<WorkLedgerEntry[]>;
    /** Entries with updatedAt strictly after `since`. */
    getEntriesUpdatedSince: (since: number) => Promise<WorkLedgerEntry[]>;
    getEntry: (id: string) => Promise<WorkLedgerEntry | undefined>;
    applyRemoteEntries: (entries: RemoteEntry[]) => Promise<number>;
  };
  isVisible: () => boolean;
}

export interface SyncState {
  config: SyncConfig;
  status: SyncStatus;
  /** Incremented whenever remote changes were written locally, so the UI can reload entries. */
  remoteRevision: number;
}

/** Thrown when an operation outlives the account or mode it started under. */
class StaleOperationError extends Error {}

function errorMessage(err: unknown, fallback: string): string {
  return err instanceof Error ? err.message : fallback;
}

function lastActivity(config: SyncConfig): number | null {
  const times = [config.lastSyncAt, config.lastPullAt].filter((t): t is number => t !== null);
  return times.length ? Math.max(...times) : null;
}

/**
 * Sync state machine, independent of React.
 *
 * All network operations run one at a time on a queue. Queued requests
 * coalesce: many push requests become one push (keeping `forceAll` if any asked
 * for it), many pull requests become one pull. Every operation captures the
 * `generation` it started under; disconnect, account changes and mode switches
 * bump it, so late results from an old operation are dropped instead of
 * overwriting newer config.
 */
export class SyncEngine {
  private state: SyncState = {
    config: { ...DEFAULT_SYNC_CONFIG },
    status: { phase: "idle", error: null, lastSyncAt: null },
    remoteRevision: 0,
  };
  private readonly listeners = new Set<() => void>();
  private loaded = false;
  private credentials: { key: CryptoKey; token: string } | null = null;
  private generation = 0;

  private queue: Promise<unknown> = Promise.resolve();
  private queuedPull: Promise<boolean> | null = null;
  private queuedPush: { promise: Promise<boolean>; forceAll: boolean } | null = null;

  /** id -> change counter. The counter lets a push clear only the changes it actually sent. */
  private readonly dirty = new Map<string, number>();
  private changeCounter = 0;
  private tombstones = new Set<string>();
  /** Push must also scan for `updatedAt > lastSyncAt`, covering changes made before this session. */
  private scanPending = true;
  private forceAllPending = false;
  private fullPullPending = false;

  private pullTimer: ReturnType<typeof setInterval> | null = null;
  private pushTimer: ReturnType<typeof setTimeout> | null = null;
  private retryTimer: ReturnType<typeof setTimeout> | null = null;
  private retryCount = 0;

  private configWrites: Promise<void> = Promise.resolve();
  private tombstoneWrites: Promise<void> = Promise.resolve();
  private tombstoneWriteQueued = false;

  private readonly deps: SyncEngineDeps;
  private readonly options: SyncOptions;

  constructor(deps: SyncEngineDeps, options: SyncOptions = DEFAULT_SYNC_OPTIONS) {
    this.deps = deps;
    this.options = options;
  }

  // --- Store interface (useSyncExternalStore) ---

  getState = (): SyncState => this.state;

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  private setState(patch: Partial<SyncState>) {
    this.state = { ...this.state, ...patch };
    for (const listener of this.listeners) listener();
  }

  private setStatus(patch: Partial<SyncStatus>) {
    this.setState({ status: { ...this.state.status, ...patch } });
  }

  // --- Lifecycle ---

  start = async (): Promise<void> => {
    const gen = ++this.generation;
    try {
      const [config, tombstones] = await Promise.all([
        this.deps.storage.loadConfig(),
        this.deps.storage.loadTombstones(),
      ]);
      if (gen !== this.generation) return;
      this.loaded = true;
      for (const id of tombstones) this.tombstones.add(id);
      this.setState({ config, status: { ...this.state.status, lastSyncAt: lastActivity(config) } });
      if (!config.syncId) {
        // Changes recorded before the config loaded don't matter without an account.
        this.dirty.clear();
        this.tombstones.clear();
        void this.persistTombstones();
      }
      await this.activate();
    } catch (err) {
      if (gen === this.generation) this.setStatus({ phase: "error", error: errorMessage(err, "Failed to load sync settings") });
    }
  };

  stop = (): void => {
    this.resetRuntime();
  };

  /** Bump the generation and stop all timers. Shared teardown for every state change. */
  private resetRuntime() {
    this.generation++;
    if (this.pullTimer) clearInterval(this.pullTimer);
    if (this.pushTimer) clearTimeout(this.pushTimer);
    if (this.retryTimer) clearTimeout(this.retryTimer);
    this.pullTimer = this.pushTimer = this.retryTimer = null;
    this.retryCount = 0;
    const { phase } = this.state.status;
    if (phase !== "idle" && phase !== "error") this.setStatus({ phase: "idle" });
  }

  private isConnected(): boolean {
    const { mode, syncId, salt } = this.state.config;
    return mode === "remote" && !!syncId && !!salt;
  }

  /** Start syncing under the current config: push pending changes, pull, poll. */
  private async activate() {
    if (!this.isConnected()) return;
    const gen = this.generation;
    const { syncId, salt } = this.state.config;
    try {
      if (!this.credentials) {
        const [key, token] = await Promise.all([deriveKey(syncId!, salt!), computeAuthToken(syncId!)]);
        if (gen !== this.generation) return;
        this.credentials = { key, token };
      }
    } catch (err) {
      if (gen === this.generation) {
        this.setStatus({ phase: "error", error: `Could not derive sync key: ${errorMessage(err, "unknown error")}` });
      }
      return;
    }
    this.scanPending = true;
    void this.requestPush();
    void this.requestPull();
    this.startPullInterval();
  }

  private startPullInterval() {
    if (this.pullTimer) clearInterval(this.pullTimer);
    this.pullTimer = setInterval(() => {
      if (this.deps.isVisible()) void this.requestPull();
    }, this.options.pullIntervalMs);
  }

  // --- Local change tracking ---

  private tracksChanges(): boolean {
    // Before the config loads we can't know yet, so record and discard later.
    // Local mode with an account still records, so switching back pushes everything.
    return !this.loaded || !!this.state.config.syncId;
  }

  notifyChanged = (entryId: string): void => {
    if (!this.tracksChanges()) return;
    if (this.tombstones.delete(entryId)) void this.persistTombstones();
    this.dirty.set(entryId, ++this.changeCounter);
    this.schedulePush();
  };

  notifyDeleted = (entryId: string): void => {
    if (!this.tracksChanges()) return;
    this.dirty.delete(entryId);
    this.tombstones.add(entryId);
    void this.persistTombstones();
    this.schedulePush();
  };

  onVisible = (): void => {
    if (this.credentials && this.isConnected()) void this.requestPull();
  };

  private schedulePush() {
    if (!this.isConnected()) return;
    if (this.pushTimer) clearTimeout(this.pushTimer);
    if (this.retryTimer) clearTimeout(this.retryTimer);
    this.retryCount = 0;
    this.pushTimer = setTimeout(() => void this.requestPush(), this.options.pushDebounceMs);
  }

  // --- Queue ---

  private enqueue<T>(task: () => Promise<T>): Promise<T> {
    const run = this.queue.then(task);
    this.queue = run.catch(() => undefined);
    return run;
  }

  /** Resolves to true when the pull succeeded. */
  requestPull(): Promise<boolean> {
    if (this.queuedPull) return this.queuedPull;
    const promise = this.enqueue(() => {
      this.queuedPull = null;
      return this.runPull();
    });
    this.queuedPull = promise;
    return promise;
  }

  /** Resolves to true when the push succeeded. */
  requestPush(forceAll = false): Promise<boolean> {
    if (this.queuedPush) {
      this.queuedPush.forceAll ||= forceAll;
      return this.queuedPush.promise;
    }
    const slot = { forceAll, promise: Promise.resolve(false) };
    slot.promise = this.enqueue(() => {
      this.queuedPush = null;
      return this.runPush(slot.forceAll);
    });
    this.queuedPush = slot;
    return slot.promise;
  }

  private assertCurrent(gen: number) {
    if (gen !== this.generation) throw new StaleOperationError();
  }

  private apiContext(): ApiContext {
    return { serverUrl: this.state.config.serverUrl, timeoutMs: this.options.requestTimeoutMs };
  }

  // --- Pull ---

  private async runPull(): Promise<boolean> {
    const gen = this.generation;
    const creds = this.credentials;
    if (!creds || !this.isConnected()) return false;

    const fullPull = this.fullPullPending;
    this.fullPullPending = false;
    let merged = 0;
    this.setStatus({ phase: "pulling" });
    try {
      const result = await pullEntries({
        api: this.deps.api,
        ctx: this.apiContext(),
        key: creds.key,
        token: creds.token,
        since: fullPull ? 0 : this.state.config.lastSyncSeq,
        pageSize: this.options.pullPageSize,
        onMerging: () => this.setStatus({ phase: "merging" }),
        apply: async (remote) => {
          this.assertCurrent(gen);
          // A pending local delete must not be undone by an older server copy.
          const changed = await this.deps.entries.applyRemoteEntries(
            remote.filter((r) => !this.tombstones.has(r.id)),
          );
          merged += changed;
          return changed;
        },
      });
      this.assertCurrent(gen);
      const now = Date.now();
      await this.updateConfig({ lastSyncSeq: result.cursor, lastPullAt: now });
      this.setStatus({ phase: "idle", error: null, lastSyncAt: now });
      return true;
    } catch (err) {
      if (err instanceof StaleOperationError || gen !== this.generation) return false;
      if (fullPull) this.fullPullPending = true;
      this.setStatus({ phase: "error", error: errorMessage(err, "Pull failed") });
      return false;
    } finally {
      // Entries already written must reach the UI even if the pull failed later.
      if (merged > 0) this.setState({ remoteRevision: this.state.remoteRevision + 1 });
    }
  }

  // --- Push ---

  private async collectEntries(forceAll: boolean, scan: boolean, dirty: Map<string, number>, since: number | null) {
    const { getAllEntries, getEntriesUpdatedSince, getEntry } = this.deps.entries;
    if (forceAll || dirty.size > this.options.bulkReadThreshold || (scan && since === null)) {
      const all = await getAllEntries();
      if (forceAll) return all;
      return all.filter((e) => dirty.has(e.id) || (scan && (since === null || e.updatedAt > since)));
    }
    // The recovery scan reads only entries edited since the last push; dirty
    // ids are looked up on top, since an entry can be dirty without a newer updatedAt.
    const changed = scan && since !== null ? await getEntriesUpdatedSince(since) : [];
    const known = new Set(changed.map((e) => e.id));
    const dirtyOnly = [...dirty.keys()].filter((id) => !known.has(id));
    const found = await Promise.all(dirtyOnly.map((id) => getEntry(id)));
    return [...changed, ...found.filter((e): e is WorkLedgerEntry => !!e)];
  }

  private async runPush(requestedForceAll: boolean): Promise<boolean> {
    const gen = this.generation;
    const creds = this.credentials;
    if (!creds || !this.isConnected()) return false;

    const forceAll = requestedForceAll || this.forceAllPending;
    const scan = forceAll || this.scanPending;
    // Taken before reading entries: anything edited after this point has a
    // newer updatedAt and is caught by the next scan or the dirty map.
    const syncedAt = Date.now();
    const dirtySnapshot = new Map(this.dirty);
    const tombstoneSnapshot = new Set(this.tombstones);

    // Clear only what this push sent: a change made while the request was in
    // flight has a newer counter and stays dirty.
    const markPushed = (ids: Iterable<string>) => {
      for (const id of ids) {
        const counter = dirtySnapshot.get(id);
        if (counter !== undefined && this.dirty.get(id) === counter) this.dirty.delete(id);
        if (tombstoneSnapshot.has(id)) this.tombstones.delete(id);
      }
    };

    this.setStatus({ phase: "pushing" });
    try {
      const entries = (await this.collectEntries(forceAll, scan, dirtySnapshot, this.state.config.lastSyncAt))
        .filter((e) => !tombstoneSnapshot.has(e.id));
      this.assertCurrent(gen);

      let rejected: string[] = [];
      if (entries.length > 0 || tombstoneSnapshot.size > 0) {
        const result = await pushEntries({
          api: this.deps.api,
          ctx: this.apiContext(),
          key: creds.key,
          token: creds.token,
          entries,
          tombstoneIds: [...tombstoneSnapshot],
          limits: this.options.batch,
          onBatchPushed: markPushed,
          assertCurrent: () => this.assertCurrent(gen),
        });
        rejected = result.rejected;
        void this.persistTombstones();
      }
      this.assertCurrent(gen);

      // Dirty ids with no entry left (and no tombstone) have nothing to send.
      markPushed(dirtySnapshot.keys());
      this.scanPending = false;
      if (forceAll) this.forceAllPending = false;
      this.retryCount = 0;
      await this.updateConfig({ lastSyncAt: syncedAt });
      this.setStatus({
        phase: "idle",
        error: rejected.length ? `${rejected.length} entries are too large to sync` : null,
        lastSyncAt: syncedAt,
      });
      return true;
    } catch (err) {
      void this.persistTombstones();
      if (err instanceof StaleOperationError || gen !== this.generation) return false;
      if (forceAll) this.forceAllPending = true;
      this.setStatus({ phase: "error", error: errorMessage(err, "Push failed") });

      const delays = this.options.retryDelaysMs;
      if (isRetryableError(err) && this.retryCount < delays.length) {
        const delay = delays[this.retryCount++];
        if (this.retryTimer) clearTimeout(this.retryTimer);
        this.retryTimer = setTimeout(() => void this.requestPush(), delay);
      }
      return false;
    }
  }

  // --- Persistence (serialized so an older write never lands after a newer one) ---

  private updateConfig(patch: Partial<SyncConfig>): Promise<void> {
    this.setState({ config: { ...this.state.config, ...patch } });
    return this.writeConfig(() => this.deps.storage.saveConfig(this.state.config));
  }

  private writeConfig(op: () => Promise<void>): Promise<void> {
    this.configWrites = this.configWrites.then(op).catch((err) => console.warn("[sync] Saving config failed:", err));
    return this.configWrites;
  }

  private persistTombstones(): Promise<void> {
    // Delete-all calls this once per entry. A queued write snapshots the set
    // when it starts, so calls made before then can share it instead of
    // queueing N full-set writes.
    if (this.tombstoneWriteQueued) return this.tombstoneWrites;
    this.tombstoneWriteQueued = true;
    this.tombstoneWrites = this.tombstoneWrites
      .then(() => {
        this.tombstoneWriteQueued = false;
        return this.deps.storage.saveTombstones([...this.tombstones]);
      })
      .catch((err) => console.warn("[sync] Saving pending deletes failed:", err));
    return this.tombstoneWrites;
  }

  // --- Account management ---

  /** Start tracking a fresh account: local change state from a previous account doesn't apply. */
  private resetAccountState(credentials: { key: CryptoKey; token: string } | null) {
    this.credentials = credentials;
    this.dirty.clear();
    this.tombstones.clear();
    this.forceAllPending = false;
    this.fullPullPending = false;
    this.scanPending = true;
    void this.persistTombstones();
  }

  generateSyncId = async (): Promise<string | null> => {
    this.resetRuntime();
    const gen = this.generation;
    this.setStatus({ phase: "connecting", error: null });
    try {
      const syncId = generateSyncIdLocal();
      const token = await computeAuthToken(syncId);
      const { salt } = await this.deps.api.createAccount(this.apiContext(), token);
      const key = await deriveKey(syncId, salt);
      this.assertCurrent(gen);

      this.resetAccountState({ key, token });
      // The new account is empty, so every existing local entry must be uploaded.
      this.forceAllPending = true;
      await this.updateConfig({ mode: "remote", syncId, salt, lastSyncSeq: 0, lastSyncAt: null, lastPullAt: null });
      this.setStatus({ phase: "idle", error: null, lastSyncAt: null });
      await this.activate();
      return syncId;
    } catch (err) {
      if (gen === this.generation && !(err instanceof StaleOperationError)) {
        this.setStatus({ phase: "error", error: errorMessage(err, "Failed to create account") });
      }
      return null;
    }
  };

  /**
   * Full bidirectional reconciliation: pull everything from the server, then
   * push every local entry. Batched pushes replace the single-request
   * /sync/full call, which overflowed the server body limit for large notebooks.
   */
  connect = async (syncId: string): Promise<boolean> => {
    this.resetRuntime();
    const gen = this.generation;
    const previous = this.state.config;
    this.setStatus({ phase: "connecting", error: null });
    try {
      const token = await computeAuthToken(syncId);
      const validation = await this.deps.api.validateAccount(this.apiContext(), token);
      if (!validation.valid) {
        this.setStatus({ phase: "error", error: "Invalid sync ID" });
        return false;
      }
      const key = await deriveKey(syncId, validation.salt);
      this.assertCurrent(gen);

      this.resetAccountState({ key, token });
      await this.updateConfig({
        mode: "remote", syncId, salt: validation.salt, lastSyncSeq: 0, lastSyncAt: null, lastPullAt: null,
      });
      const ok = (await this.requestPull()) && (await this.requestPush(true));
      this.assertCurrent(gen);
      if (!ok) {
        // Not connected until the first reconciliation succeeds. Keep the error status.
        const { error } = this.state.status;
        this.resetRuntime();
        this.resetAccountState(null);
        await this.updateConfig(previous);
        this.setStatus({ phase: "error", error });
        return false;
      }
      this.startPullInterval();
      return true;
    } catch (err) {
      if (gen === this.generation && !(err instanceof StaleOperationError)) {
        this.setStatus({ phase: "error", error: errorMessage(err, "Connection failed") });
      }
      return false;
    }
  };

  disconnect = async (): Promise<void> => {
    this.resetRuntime();
    this.resetAccountState(null);
    this.setState({
      config: { ...DEFAULT_SYNC_CONFIG },
      status: { phase: "idle", error: null, lastSyncAt: null },
    });
    await Promise.all([this.writeConfig(() => this.deps.storage.clearConfig()), this.tombstoneWrites]);
  };

  /** Returns false and keeps the account connected when the server delete failed. */
  deleteAccount = async (): Promise<boolean> => {
    const { syncId } = this.state.config;
    if (syncId) {
      try {
        const token = this.credentials?.token ?? (await computeAuthToken(syncId));
        await this.deps.api.deleteAccount(this.apiContext(), token);
      } catch (err) {
        // 404: the account is already gone, which is the goal.
        if (!(err instanceof SyncHttpError && err.status === 404)) {
          this.setStatus({ phase: "error", error: `Could not delete server account: ${errorMessage(err, "unknown error")}` });
          return false;
        }
      }
    }
    await this.disconnect();
    return true;
  };

  setMode = async (mode: SyncMode): Promise<void> => {
    if (mode === this.state.config.mode) return;
    this.resetRuntime();
    // Dirty ids and tombstones are kept in local mode so switching back pushes them.
    await this.updateConfig({ mode });
    if (mode === "remote") await this.activate();
  };

  /** Returns an error message when the URL is rejected. */
  setServerUrl = async (url: string | null): Promise<string | null> => {
    if (url) {
      const error = validateServerUrl(url);
      if (error) return error;
    }
    await this.updateConfig({ serverUrl: url || null });
    return null;
  };

  /** Recovery: re-pull everything from the start, then push every local entry. */
  syncNow = async (): Promise<void> => {
    if (!this.credentials || !this.isConnected()) return;
    this.fullPullPending = true;
    await Promise.all([this.requestPull(), this.requestPush(true)]);
  };
}
