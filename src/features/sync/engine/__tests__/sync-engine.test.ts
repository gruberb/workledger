/**
 * SyncEngine tests against an in-memory server that applies the same
 * last-write-wins rule as workledger-sync, with real crypto.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { SyncEngine, DEFAULT_SYNC_OPTIONS, type SyncEngineDeps } from "../sync-engine.ts";
import { SyncHttpError, type SyncApi } from "../../utils/sync-api.ts";
import { DEFAULT_SYNC_CONFIG, type SyncConfig, type SyncEntry } from "../../types/sync.ts";
import type { SyncStorage } from "../../storage/sync-settings.ts";
import type { RemoteEntry, WorkLedgerEntry } from "../../../entries/index.ts";
import { encryptEntry } from "../../utils/sync-crypto.ts";
import { deriveKey } from "../../utils/crypto.ts";

const SALT = btoa("0123456789abcdef");
const SYNC_ID = "wl-0123456789abcdef0123";

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((r) => { resolve = r; });
  return { promise, resolve };
}

class FakeServer {
  entries = new Map<string, SyncEntry & { serverSeq: number }>();
  seq = 0;
  /** When set, push/pull wait for it, simulating a request in flight. */
  gate: Promise<void> | null = null;
  failPush: SyncHttpError | null = null;
  failDelete: SyncHttpError | null = null;
  pushedBatches: SyncEntry[][] = [];

  api: SyncApi = {
    createAccount: vi.fn(async () => ({ salt: SALT })),
    validateAccount: vi.fn(async () => ({ valid: true, salt: SALT })),
    deleteAccount: vi.fn(async () => {
      if (this.failDelete) throw this.failDelete;
    }),
    pushEntries: vi.fn(async (_ctx, _token, batch: SyncEntry[]) => {
      if (this.gate) await this.gate;
      if (this.failPush) throw this.failPush;
      this.pushedBatches.push(batch);
      for (const e of batch) {
        const existing = this.entries.get(e.id);
        if (existing && existing.updatedAt >= e.updatedAt) continue;
        this.entries.set(e.id, { ...e, serverSeq: ++this.seq });
      }
      return { serverSeq: this.seq };
    }),
    pullEntries: vi.fn(async (_ctx, _token, since: number, limit: number) => {
      if (this.gate) await this.gate;
      const newer = [...this.entries.values()].filter((e) => e.serverSeq > since).sort((a, b) => a.serverSeq - b.serverSeq);
      return { entries: newer.slice(0, limit), serverSeq: this.seq, hasMore: newer.length > limit };
    }),
  };

  pushedIds(): string[] {
    return this.pushedBatches.flat().map((e) => e.id);
  }
}

class FakeStorage implements SyncStorage {
  config: SyncConfig | null = null;
  tombstones: string[] = [];
  loadConfig = async () => this.config ?? { ...DEFAULT_SYNC_CONFIG };
  saveConfig = async (c: SyncConfig) => { this.config = { ...c }; };
  clearConfig = async () => { this.config = null; };
  loadTombstones = async () => [...this.tombstones];
  saveTombstones = async (ids: string[]) => { this.tombstones = [...ids]; };
}

class FakeEntries {
  map = new Map<string, WorkLedgerEntry>();
  getAllEntries = async () => [...this.map.values()];
  getEntry = async (id: string) => this.map.get(id);
  applyRemoteEntries = async (remote: RemoteEntry[]) => {
    let changed = 0;
    for (const r of remote) {
      const local = this.map.get(r.id);
      if (r.isDeleted) {
        if (local) { this.map.delete(r.id); changed++; }
      } else if (!local || r.updatedAt > local.updatedAt) {
        this.map.set(r.id, r.data as WorkLedgerEntry);
        changed++;
      }
    }
    return changed;
  };
  put(id: string, updatedAt: number, text = id) {
    this.map.set(id, {
      id, dayKey: "2025-06-15", createdAt: 1, updatedAt, isArchived: false, tags: [], isPinned: false,
      blocks: [{ type: "paragraph", content: [{ type: "text", text }] }],
    });
  }
}

let server: FakeServer;
let storage: FakeStorage;
let entries: FakeEntries;
let engines: SyncEngine[];

function connectedConfig(overrides: Partial<SyncConfig> = {}): SyncConfig {
  return { ...DEFAULT_SYNC_CONFIG, mode: "remote", syncId: SYNC_ID, salt: SALT, lastPullAt: 0, ...overrides };
}

function makeEngine(options = {}) {
  const deps: SyncEngineDeps = {
    api: server.api,
    storage,
    entries,
    isVisible: () => true,
  };
  // Long timers: tests drive pushes and pulls explicitly.
  const engine = new SyncEngine(deps, {
    ...DEFAULT_SYNC_OPTIONS,
    pullIntervalMs: 1e9,
    pushDebounceMs: 1e9,
    retryDelaysMs: [],
    ...options,
  });
  engines.push(engine);
  return engine;
}

/** Start and wait for the startup push and pull. */
async function startConnected(config = connectedConfig()) {
  storage.config = config;
  const engine = makeEngine();
  await engine.start();
  await engine.requestPull();
  return engine;
}

beforeEach(() => {
  server = new FakeServer();
  storage = new FakeStorage();
  entries = new FakeEntries();
  engines = [];
  vi.spyOn(console, "warn").mockImplementation(() => undefined);
});

afterEach(() => {
  for (const e of engines) e.stop();
  vi.restoreAllMocks();
});

describe("push", () => {
  it("keeps changes made while a push is in flight", async () => {
    const engine = await startConnected();
    entries.put("x", 10);
    engine.notifyChanged("x");

    const gate = deferred();
    server.gate = gate.promise;
    const firstPush = engine.requestPush();
    await vi.waitFor(() => expect(server.api.pushEntries).toHaveBeenCalled());

    entries.put("y", 20);
    engine.notifyChanged("y");
    entries.put("x", 30, "edited again");
    engine.notifyChanged("x");

    server.gate = null;
    gate.resolve();
    await firstPush;
    expect(server.entries.has("y")).toBe(false);

    await engine.requestPush();
    expect(server.entries.get("y")?.updatedAt).toBe(20);
    expect(server.entries.get("x")?.updatedAt).toBe(30);
  });

  it("pushes edits made before this session via the lastSyncAt scan", async () => {
    entries.put("old-unsynced", 500);
    entries.put("already-synced", 50);
    await startConnected(connectedConfig({ lastSyncAt: 100 }));
    expect(server.pushedIds()).toEqual(["old-unsynced"]);
  });

  it("keeps forceAll when the push had to wait for a running pull", async () => {
    const engine = await startConnected();
    entries.put("a", 1);
    entries.put("b", 2);

    const gate = deferred();
    server.gate = gate.promise;
    const pull = engine.requestPull();
    const sync = engine.syncNow();
    server.gate = null;
    gate.resolve();
    await Promise.all([pull, sync]);

    expect(server.pushedIds().sort()).toEqual(["a", "b"]);
  });

  it("retries a failed forceAll push as forceAll", async () => {
    const engine = await startConnected();
    entries.put("a", 1);
    server.failPush = new SyncHttpError(500, "down");
    await engine.syncNow();
    expect(engine.getState().status.phase).toBe("error");

    server.failPush = null;
    await engine.requestPush();
    expect(server.pushedIds()).toEqual(["a"]);
  });

  it("batches large pushes", async () => {
    storage.config = connectedConfig();
    for (let i = 0; i < 5; i++) entries.put(`e${i}`, 1);
    const engine = makeEngine({ batch: { maxEntries: 2, maxBytes: 1_000_000 } });
    await engine.start();
    await engine.requestPull(); // startup push scans everything: lastSyncAt is null
    expect(server.pushedBatches.map((b) => b.length)).toEqual([2, 2, 1]);
  });
});

describe("pull", () => {
  it("advances lastSyncSeq and lastPullAt but never lastSyncAt", async () => {
    const engine = await startConnected(connectedConfig({ lastSyncAt: 1234 }));
    // Startup push sent nothing new, so lastSyncAt advanced only by that push.
    const afterStartup = engine.getState().config.lastSyncAt;

    server.entries.set("remote", { ...(await encryptWith(SYNC_ID, "remote")), serverSeq: ++server.seq });
    await engine.requestPull();

    const { config } = engine.getState();
    expect(config.lastSyncAt).toBe(afterStartup);
    expect(config.lastSyncSeq).toBe(server.seq);
    expect(config.lastPullAt).not.toBeNull();
    expect(entries.map.has("remote")).toBe(true);
    expect(engine.getState().remoteRevision).toBeGreaterThan(0);
  });

  it("syncNow re-pulls from the start even if a pull was running", async () => {
    const engine = await startConnected();
    server.entries.set("early", { ...(await encryptWith(SYNC_ID, "early")), serverSeq: ++server.seq });
    await engine.requestPull();
    entries.map.delete("early"); // lost locally, e.g. by an old cursor bug

    await engine.syncNow();
    expect(entries.map.has("early")).toBe(true);
  });
});

describe("tombstones", () => {
  it("persists deletes and pushes them after a reload", async () => {
    const engine = await startConnected();
    entries.put("doomed", 5);
    engine.notifyChanged("doomed");
    await engine.requestPush();
    expect(server.entries.get("doomed")?.isDeleted).toBe(false);

    entries.map.delete("doomed");
    engine.notifyDeleted("doomed");
    await vi.waitFor(() => expect(storage.tombstones).toEqual(["doomed"]));
    engine.stop(); // reload before the push debounce fired

    await startConnected(storage.config!);
    expect(server.entries.get("doomed")?.isDeleted).toBe(true);
    expect(storage.tombstones).toEqual([]);
  });

  it("coalesces tombstone writes for bulk deletes", async () => {
    const engine = await startConnected();
    const save = vi.spyOn(storage, "saveTombstones");
    for (let i = 0; i < 500; i++) engine.notifyDeleted(`bulk-${i}`);
    await vi.waitFor(() => expect(storage.tombstones).toHaveLength(500));
    expect(save.mock.calls.length).toBeLessThanOrEqual(2);
  });

  it("does not resurrect a pending local delete from an older server copy", async () => {
    const engine = await startConnected();
    server.entries.set("doomed", { ...(await encryptWith(SYNC_ID, "doomed")), serverSeq: ++server.seq });

    server.failPush = new SyncHttpError(500, "down");
    engine.notifyDeleted("doomed");
    await engine.requestPush();
    await engine.syncNow();
    expect(entries.map.has("doomed")).toBe(false);
  });

  it("records deletes in local mode and pushes them when switching back", async () => {
    const engine = await startConnected();
    await engine.setMode("local");
    engine.notifyDeleted("gone-while-local");
    await engine.setMode("remote");
    await engine.requestPull();
    expect(server.entries.get("gone-while-local")?.isDeleted).toBe(true);
  });
});

describe("account lifecycle", () => {
  it("uploads existing entries when generating a new account", async () => {
    entries.put("a", 1);
    entries.put("b", 2);
    const engine = makeEngine();
    await engine.start();
    await engine.setMode("remote");
    expect(await engine.generateSyncId()).toMatch(/^wl-/);
    await engine.requestPull();
    expect(server.pushedIds().sort()).toEqual(["a", "b"]);
  });

  it("drops a pull result that finishes after disconnect", async () => {
    const engine = await startConnected();
    const gate = deferred();
    server.gate = gate.promise;
    const pull = engine.requestPull();
    await vi.waitFor(() => expect(engine.getState().status.phase).toBe("pulling"));

    await engine.disconnect();
    server.gate = null;
    gate.resolve();
    await pull;

    expect(engine.getState().config.syncId).toBeNull();
    expect(storage.config).toBeNull();
  });

  it("drops a pull result that finishes after switching to local", async () => {
    const engine = await startConnected();
    const gate = deferred();
    server.gate = gate.promise;
    const pull = engine.requestPull();
    await vi.waitFor(() => expect(engine.getState().status.phase).toBe("pulling"));

    await engine.setMode("local");
    server.gate = null;
    gate.resolve();
    await pull;
    expect(engine.getState().config.mode).toBe("local");
    expect(storage.config?.mode).toBe("local");
  });

  it("stays connected when the server delete fails", async () => {
    const engine = await startConnected();
    server.failDelete = new SyncHttpError(500, "nope");
    expect(await engine.deleteAccount()).toBe(false);
    expect(engine.getState().config.syncId).toBe(SYNC_ID);
    expect(engine.getState().status.error).toMatch(/nope/);
  });

  it("treats an already deleted account as success", async () => {
    const engine = await startConnected();
    server.failDelete = new SyncHttpError(404, "gone");
    expect(await engine.deleteAccount()).toBe(true);
    expect(engine.getState().config.syncId).toBeNull();
  });

  it("connect reconciles both ways", async () => {
    entries.put("local-only", 3);
    const other = makeEngine();
    server.entries.set("remote-only", { ...(await encryptWith(SYNC_ID, "remote-only")), serverSeq: ++server.seq });
    await other.start();
    await other.setMode("remote");
    expect(await other.connect(SYNC_ID)).toBe(true);
    expect(entries.map.has("remote-only")).toBe(true);
    expect(server.entries.has("local-only")).toBe(true);
  });

  it("reports a key derivation failure instead of failing silently", async () => {
    storage.config = connectedConfig({ salt: "not base64!!" });
    const engine = makeEngine();
    await engine.start();
    expect(engine.getState().status.phase).toBe("error");
  });

  it("rejects a plain http server URL that is not localhost", async () => {
    const engine = makeEngine();
    await engine.start();
    expect(await engine.setServerUrl("http://sync.example.com")).toMatch(/https/);
    expect(await engine.setServerUrl("http://localhost:3000")).toBeNull();
    expect(engine.getState().config.serverUrl).toBe("http://localhost:3000");
  });
});

// --- helpers that encrypt as another device would ---

async function encryptWith(syncId: string, id: string): Promise<SyncEntry> {
  const key = await deriveKey(syncId, SALT);
  return encryptEntry(key, {
    id, dayKey: "2025-06-15", createdAt: 1, updatedAt: 1, isArchived: false, tags: [], isPinned: false,
    blocks: [{ type: "paragraph", content: [{ type: "text", text: id }] }],
  });
}
