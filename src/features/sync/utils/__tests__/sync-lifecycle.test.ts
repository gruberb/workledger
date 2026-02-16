/**
 * Sync lifecycle integration tests.
 *
 * These test full encrypt → push → pull → decrypt → merge cycles
 * using real crypto (no mocks for encrypt/decrypt) and a simulated
 * in-memory server state for the API layer.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { deriveKey } from "../crypto.ts";
import { encryptEntry } from "../sync-crypto.ts";
import { pushEntries, pullEntries } from "../sync-operations.ts";
import type { SyncConfig, SyncEntry, PullResponse } from "../../types/sync.ts";

// --- In-memory "server" ---

let serverEntries: SyncEntry[] = [];
let serverSeqCounter = 0;

function serverReset() {
  serverEntries = [];
  serverSeqCounter = 0;
}

function serverPush(entries: SyncEntry[]) {
  for (const entry of entries) {
    serverSeqCounter++;
    const existing = serverEntries.findIndex((e) => e.id === entry.id);
    const withSeq = { ...entry, serverSeq: serverSeqCounter };
    if (existing >= 0) {
      serverEntries[existing] = withSeq;
    } else {
      serverEntries.push(withSeq);
    }
  }
  return { accepted: entries.length, conflicts: [], serverSeq: serverSeqCounter };
}

function serverPull(since: number, limit: number): PullResponse {
  const filtered = serverEntries
    .filter((e) => (e.serverSeq ?? 0) > since)
    .sort((a, b) => (a.serverSeq ?? 0) - (b.serverSeq ?? 0));
  const page = filtered.slice(0, limit);
  const hasMore = filtered.length > limit;
  return {
    entries: page,
    serverSeq: serverSeqCounter,
    hasMore,
  };
}

// --- Mock only the API and IDB layers ---

vi.mock("../sync-api.ts", () => ({
  apiPushEntries: vi.fn((_token: string, entries: SyncEntry[]) => {
    return Promise.resolve(serverPush(entries));
  }),
  apiPullEntries: vi.fn((_token: string, since: number, limit: number) => {
    return Promise.resolve(serverPull(since, limit));
  }),
}));

// In-memory IDB simulation
const idbEntries = new Map<string, Record<string, unknown>>();
const idbSearchIndex = new Map<string, Record<string, unknown>>();

vi.mock("../../../../storage/db.ts", () => ({
  getDB: vi.fn(() => Promise.resolve({
    put: vi.fn((_store: string, entry: Record<string, unknown>) => {
      idbEntries.set(entry.id as string, entry);
      return Promise.resolve();
    }),
    delete: vi.fn((_store: string, id: string) => {
      idbEntries.delete(id);
      return Promise.resolve();
    }),
  })),
}));

vi.mock("../../../entries/index.ts", () => ({
  getAllEntries: vi.fn(() => Promise.resolve(Array.from(idbEntries.values()))),
  getEntry: vi.fn((id: string) => Promise.resolve(idbEntries.get(id) ?? null)),
  deleteSearchIndex: vi.fn((id: string) => { idbSearchIndex.delete(id); return Promise.resolve(); }),
  updateSearchIndex: vi.fn((id: string, dayKey: string, blocks: unknown[], tags: string[]) => {
    idbSearchIndex.set(id, { id, dayKey, blocks, tags });
    return Promise.resolve();
  }),
  validateEntry: vi.fn((entry: unknown) => entry),
}));

// --- Helpers ---

let cryptoKey: CryptoKey;

async function setupCrypto() {
  const salt = btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(16))));
  cryptoKey = await deriveKey("wl-lifecycle-test", salt);
}

function makeConfig(overrides: Partial<SyncConfig> = {}): SyncConfig {
  return {
    mode: "remote",
    syncId: "wl-lifecycle-test",
    salt: "dGVzdA==",
    serverUrl: null,
    lastSyncSeq: 0,
    lastSyncAt: null,
    ...overrides,
  };
}

function addLocalEntry(id: string, dayKey: string, blocks: unknown[], tags: string[] = [], updatedAt = Date.now()) {
  const entry = { id, dayKey, createdAt: updatedAt - 1000, updatedAt, blocks, isArchived: false, tags };
  idbEntries.set(id, entry);
  return entry;
}

beforeEach(async () => {
  vi.clearAllMocks();
  serverReset();
  idbEntries.clear();
  idbSearchIndex.clear();
  await setupCrypto();
});

afterEach(() => {
  vi.restoreAllMocks();
});

// =================== Full lifecycle tests ===================

describe("lifecycle: fresh → remote → sync", () => {
  it("pushes local entries to empty server, then pulls them back", async () => {
    // 1. Create local entries
    addLocalEntry("entry-1", "2025-06-15", [{ type: "paragraph", content: [{ type: "text", text: "Hello" }] }], ["work"]);
    addLocalEntry("entry-2", "2025-06-16", [{ type: "paragraph", content: [{ type: "text", text: "World" }] }], ["personal"]);

    // 2. Push all entries to server
    const pushResult = await pushEntries({
      key: cryptoKey,
      token: "tok",
      config: makeConfig(),
      dirtyIds: new Set(["entry-1", "entry-2"]),
      deletedIds: new Set(),
      forceAll: false,
    });

    expect(pushResult).not.toBeNull();
    expect(serverEntries).toHaveLength(2);

    // Verify entries are actually encrypted (not plaintext)
    for (const se of serverEntries) {
      expect(se.encryptedPayload).toBeTruthy();
      expect(se.encryptedPayload).not.toContain("Hello");
      expect(se.encryptedPayload).not.toContain("World");
    }

    // 3. Simulate "second device" — clear local, pull from server
    idbEntries.clear();
    idbSearchIndex.clear();

    const pullResult = await pullEntries({
      key: cryptoKey,
      token: "tok",
      config: makeConfig({ lastSyncSeq: 0 }),
    });

    expect(pullResult.hadEntries).toBe(true);
    expect(idbEntries.size).toBe(2);

    // 4. Verify decrypted content matches original
    const pulled1 = idbEntries.get("entry-1") as Record<string, unknown>;
    expect(pulled1).toBeDefined();
    expect(pulled1.dayKey).toBe("2025-06-15");
    expect(pulled1.tags).toEqual(["work"]);

    const pulled2 = idbEntries.get("entry-2") as Record<string, unknown>;
    expect(pulled2).toBeDefined();
    expect(pulled2.dayKey).toBe("2025-06-16");

    // 5. Verify search index was updated for merged entries
    expect(idbSearchIndex.has("entry-1")).toBe(true);
    expect(idbSearchIndex.has("entry-2")).toBe(true);
  });
});

describe("lifecycle: conflict resolution", () => {
  it("remote wins when remote.updatedAt > local.updatedAt", async () => {
    // Local has an older version
    addLocalEntry("entry-1", "2025-06-15", [{ type: "paragraph", content: [{ type: "text", text: "Old" }] }], [], 1000);

    // Encrypt a newer remote version and push to server
    const remoteEntry = {
      id: "entry-1",
      dayKey: "2025-06-15",
      createdAt: 500,
      updatedAt: 5000,
      blocks: [{ type: "paragraph", content: [{ type: "text", text: "New from remote" }] }],
      isArchived: false,
      tags: ["updated"],
    };
    const encrypted = await encryptEntry(cryptoKey, remoteEntry);
    serverPush([encrypted]);

    // Pull — should overwrite local
    await pullEntries({
      key: cryptoKey,
      token: "tok",
      config: makeConfig(),
    });

    const local = idbEntries.get("entry-1") as Record<string, unknown>;
    expect(local.updatedAt).toBe(5000);
    expect(local.tags).toEqual(["updated"]);
  });

  it("local wins when timestamps are equal (tie → keep local)", async () => {
    const ts = 3000;
    addLocalEntry("entry-1", "2025-06-15", [{ type: "paragraph", content: [{ type: "text", text: "Local version" }] }], ["local"], ts);

    const remoteEntry = {
      id: "entry-1",
      dayKey: "2025-06-15",
      createdAt: 1000,
      updatedAt: ts,
      blocks: [{ type: "paragraph", content: [{ type: "text", text: "Remote version" }] }],
      isArchived: false,
      tags: ["remote"],
    };
    const encrypted = await encryptEntry(cryptoKey, remoteEntry);
    serverPush([encrypted]);

    await pullEntries({
      key: cryptoKey,
      token: "tok",
      config: makeConfig(),
    });

    const local = idbEntries.get("entry-1") as Record<string, unknown>;
    // Local should still have its original tags
    expect(local.tags).toEqual(["local"]);
  });
});

describe("lifecycle: deletion propagation", () => {
  it("remote deletion removes local entry and search index", async () => {
    addLocalEntry("entry-1", "2025-06-15", [{ type: "paragraph" }], ["work"]);
    idbSearchIndex.set("entry-1", { id: "entry-1" });

    // Push deletion marker to server
    const deletionMarker: SyncEntry = {
      id: "entry-1",
      updatedAt: Date.now(),
      isArchived: false,
      isDeleted: true,
      encryptedPayload: "",
      integrityHash: "",
    };
    serverPush([deletionMarker]);

    await pullEntries({
      key: cryptoKey,
      token: "tok",
      config: makeConfig(),
    });

    expect(idbEntries.has("entry-1")).toBe(false);
    expect(idbSearchIndex.has("entry-1")).toBe(false);
  });
});

describe("lifecycle: corrupt entry recovery", () => {
  it("skips corrupt entries during pull without blocking good ones", async () => {
    // Push a good entry
    const goodEntry = {
      id: "good-1",
      dayKey: "2025-06-15",
      createdAt: 1000,
      updatedAt: 2000,
      blocks: [{ type: "paragraph", content: [{ type: "text", text: "Valid" }] }],
      isArchived: false,
      tags: [],
    };
    const encryptedGood = await encryptEntry(cryptoKey, goodEntry);
    serverPush([encryptedGood]);

    // Push a "corrupt" entry — valid structure but encrypted with a different key
    const differentSalt = btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(16))));
    const differentKey = await deriveKey("wl-different-key", differentSalt);
    const corruptEntry = {
      id: "corrupt-1",
      dayKey: "2025-06-15",
      createdAt: 1000,
      updatedAt: 3000,
      blocks: [{ type: "paragraph" }],
      isArchived: false,
      tags: [],
    };
    const encryptedCorrupt = await encryptEntry(differentKey, corruptEntry);
    serverPush([encryptedCorrupt]);

    // Push another good entry
    const goodEntry2 = {
      id: "good-2",
      dayKey: "2025-06-16",
      createdAt: 1000,
      updatedAt: 4000,
      blocks: [{ type: "paragraph", content: [{ type: "text", text: "Also valid" }] }],
      isArchived: false,
      tags: [],
    };
    const encryptedGood2 = await encryptEntry(cryptoKey, goodEntry2);
    serverPush([encryptedGood2]);

    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    const result = await pullEntries({
      key: cryptoKey,
      token: "tok",
      config: makeConfig(),
    });

    // Good entries should be merged, corrupt entry skipped
    expect(result.hadEntries).toBe(true);
    expect(idbEntries.has("good-1")).toBe(true);
    expect(idbEntries.has("good-2")).toBe(true);
    expect(idbEntries.has("corrupt-1")).toBe(false);

    // Should have logged a warning for the corrupt entry
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining("corrupt-1"),
      expect.anything(),
    );

    warnSpy.mockRestore();
  });
});

describe("lifecycle: pagination with many entries", () => {
  it("pulls 150+ entries across multiple pages correctly", async () => {
    // Push 150 entries to server
    for (let i = 1; i <= 150; i++) {
      const entry = {
        id: `entry-${i}`,
        dayKey: "2025-06-15",
        createdAt: 1000,
        updatedAt: 2000 + i,
        blocks: [],
        isArchived: false,
        tags: [],
      };
      const encrypted = await encryptEntry(cryptoKey, entry);
      serverPush([encrypted]);
    }

    expect(serverEntries).toHaveLength(150);

    // Pull — should paginate (page size 100)
    const result = await pullEntries({
      key: cryptoKey,
      token: "tok",
      config: makeConfig(),
    });

    // All 150 entries should be in local IDB
    expect(idbEntries.size).toBe(150);
    expect(result.hadEntries).toBe(true);
    expect(result.serverSeq).toBe(150);

    // Verify a few spot-checks
    expect(idbEntries.has("entry-1")).toBe(true);
    expect(idbEntries.has("entry-100")).toBe(true);
    expect(idbEntries.has("entry-150")).toBe(true);
  });
});

describe("lifecycle: resync (syncNow recovery)", () => {
  it("re-pulling from seq 0 recovers previously skipped entries", async () => {
    // Push entries to server
    for (let i = 1; i <= 5; i++) {
      const entry = {
        id: `entry-${i}`,
        dayKey: "2025-06-15",
        createdAt: 1000,
        updatedAt: 2000 + i,
        blocks: [{ type: "paragraph", content: [{ type: "text", text: `Content ${i}` }] }],
        isArchived: false,
        tags: [],
      };
      const encrypted = await encryptEntry(cryptoKey, entry);
      serverPush([encrypted]);
    }

    // Simulate a situation where we only pulled up to seq 2 (entries 3-5 were "skipped")
    const partialResult = await pullEntries({
      key: cryptoKey,
      token: "tok",
      config: makeConfig({ lastSyncSeq: 0 }),
    });
    expect(partialResult.hadEntries).toBe(true);

    // Clear local to simulate data loss
    idbEntries.clear();
    idbSearchIndex.clear();

    // Re-pull from seq 0 (what syncNow does)
    const resyncResult = await pullEntries({
      key: cryptoKey,
      token: "tok",
      config: makeConfig({ lastSyncSeq: 0 }),
    });

    expect(resyncResult.hadEntries).toBe(true);
    expect(idbEntries.size).toBe(5);

    // All entries recovered
    for (let i = 1; i <= 5; i++) {
      expect(idbEntries.has(`entry-${i}`)).toBe(true);
    }
  });
});

describe("lifecycle: archive round-trip", () => {
  it("archived flag survives encrypt → push → pull → decrypt cycle", async () => {
    addLocalEntry("entry-1", "2025-06-15", [{ type: "paragraph" }], ["work"]);
    // Mark as archived in local IDB
    const entry = idbEntries.get("entry-1") as Record<string, unknown>;
    entry.isArchived = true;
    entry.updatedAt = Date.now();

    // Push
    await pushEntries({
      key: cryptoKey,
      token: "tok",
      config: makeConfig(),
      dirtyIds: new Set(["entry-1"]),
      deletedIds: new Set(),
      forceAll: false,
    });

    // Clear local, pull
    idbEntries.clear();

    await pullEntries({
      key: cryptoKey,
      token: "tok",
      config: makeConfig(),
    });

    const pulled = idbEntries.get("entry-1") as Record<string, unknown>;
    expect(pulled).toBeDefined();
    expect(pulled.isArchived).toBe(true);
  });
});
