import { describe, it, expect, vi, beforeEach } from "vitest";
import { pushEntries, pullEntries } from "../sync-operations.ts";
import type { SyncConfig, SyncEntry } from "../../types/sync.ts";

// --- Mocks ---

vi.mock("../sync-api.ts", () => ({
  apiPushEntries: vi.fn(),
  apiPullEntries: vi.fn(),
}));

vi.mock("../sync-crypto.ts", () => ({
  encryptEntry: vi.fn((_, entry: Record<string, unknown>) =>
    Promise.resolve({
      id: entry.id,
      updatedAt: entry.updatedAt,
      isArchived: entry.isArchived ?? false,
      isDeleted: entry.isDeleted ?? false,
      encryptedPayload: "encrypted-" + entry.id,
      integrityHash: "hash-" + entry.id,
    }),
  ),
  decryptEntry: vi.fn((_key: unknown, entry: SyncEntry) =>
    Promise.resolve({
      id: entry.id,
      dayKey: "2025-06-15",
      createdAt: 1000,
      updatedAt: entry.updatedAt,
      blocks: [{ type: "paragraph" }],
      isArchived: entry.isArchived,
      isDeleted: entry.isDeleted,
      tags: [],
    }),
  ),
}));

vi.mock("../merge.ts", () => ({
  mergeRemoteEntries: vi.fn(() => Promise.resolve(0)),
}));

vi.mock("../../../entries/index.ts", () => ({
  getAllEntries: vi.fn(() => Promise.resolve([])),
}));

import { apiPushEntries, apiPullEntries } from "../sync-api.ts";
import { encryptEntry, decryptEntry } from "../sync-crypto.ts";
import { mergeRemoteEntries } from "../merge.ts";
import { getAllEntries } from "../../../entries/index.ts";

const fakeKey = {} as CryptoKey;

function makeConfig(overrides: Partial<SyncConfig> = {}): SyncConfig {
  return {
    mode: "remote",
    syncId: "wl-test",
    salt: "dGVzdA==",
    serverUrl: null,
    lastSyncSeq: 0,
    lastSyncAt: null,
    ...overrides,
  };
}

function makeEntry(id: string, updatedAt: number) {
  return {
    id,
    dayKey: "2025-06-15",
    createdAt: 1000,
    updatedAt,
    blocks: [],
    isArchived: false,
    tags: [],
  };
}

function makeSyncEntry(id: string, serverSeq: number): SyncEntry {
  return {
    id,
    updatedAt: 2000,
    isArchived: false,
    isDeleted: false,
    encryptedPayload: "enc-" + id,
    integrityHash: "hash-" + id,
    serverSeq,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

// =================== pushEntries ===================

describe("pushEntries", () => {
  it("pushes only dirty entries when dirtyIds has entries", async () => {
    const entries = [makeEntry("e1", 1000), makeEntry("e2", 2000), makeEntry("e3", 3000)];
    vi.mocked(getAllEntries).mockResolvedValue(entries as never);
    vi.mocked(apiPushEntries).mockResolvedValue({ accepted: 1, conflicts: [], serverSeq: 10 });

    const result = await pushEntries({
      key: fakeKey,
      token: "tok",
      config: makeConfig(),
      dirtyIds: new Set(["e2"]),
      deletedIds: new Set(),
      forceAll: false,
    });

    expect(encryptEntry).toHaveBeenCalledTimes(1);
    expect(encryptEntry).toHaveBeenCalledWith(fakeKey, entries[1]);
    expect(result).toEqual({ serverSeq: 10, syncedAt: expect.any(Number) });
  });

  it("pushes ALL entries when forceAll is true", async () => {
    const entries = [makeEntry("e1", 1000), makeEntry("e2", 2000)];
    vi.mocked(getAllEntries).mockResolvedValue(entries as never);
    vi.mocked(apiPushEntries).mockResolvedValue({ accepted: 2, conflicts: [], serverSeq: 5 });

    await pushEntries({
      key: fakeKey,
      token: "tok",
      config: makeConfig(),
      dirtyIds: new Set(),
      deletedIds: new Set(),
      forceAll: true,
    });

    expect(encryptEntry).toHaveBeenCalledTimes(2);
  });

  it("falls back to lastSyncAt filter when no dirty IDs and not forceAll", async () => {
    const entries = [makeEntry("e1", 1000), makeEntry("e2", 5000)];
    vi.mocked(getAllEntries).mockResolvedValue(entries as never);
    vi.mocked(apiPushEntries).mockResolvedValue({ accepted: 1, conflicts: [], serverSeq: 3 });

    await pushEntries({
      key: fakeKey,
      token: "tok",
      config: makeConfig({ lastSyncAt: 3000 }),
      dirtyIds: new Set(),
      deletedIds: new Set(),
      forceAll: false,
    });

    // Only e2 (updatedAt 5000 > lastSyncAt 3000)
    expect(encryptEntry).toHaveBeenCalledTimes(1);
    expect(encryptEntry).toHaveBeenCalledWith(fakeKey, entries[1]);
  });

  it("pushes all entries when lastSyncAt is null (first sync)", async () => {
    const entries = [makeEntry("e1", 1000), makeEntry("e2", 2000)];
    vi.mocked(getAllEntries).mockResolvedValue(entries as never);
    vi.mocked(apiPushEntries).mockResolvedValue({ accepted: 2, conflicts: [], serverSeq: 1 });

    await pushEntries({
      key: fakeKey,
      token: "tok",
      config: makeConfig({ lastSyncAt: null }),
      dirtyIds: new Set(),
      deletedIds: new Set(),
      forceAll: false,
    });

    expect(encryptEntry).toHaveBeenCalledTimes(2);
  });

  it("builds deletion markers for deleted entries", async () => {
    vi.mocked(getAllEntries).mockResolvedValue([]);
    vi.mocked(apiPushEntries).mockResolvedValue({ accepted: 1, conflicts: [], serverSeq: 1 });

    await pushEntries({
      key: fakeKey,
      token: "tok",
      config: makeConfig(),
      dirtyIds: new Set(["del-1"]),
      deletedIds: new Set(["del-1"]),
      forceAll: false,
    });

    // Should have been called with entries containing the deletion marker
    const pushCall = vi.mocked(apiPushEntries).mock.calls[0];
    const pushedEntries = pushCall[1] as SyncEntry[];
    const marker = pushedEntries.find((e) => e.id === "del-1");
    expect(marker).toBeDefined();
    expect(marker!.isDeleted).toBe(true);
    expect(marker!.encryptedPayload).toBe("");
  });

  it("returns null when nothing to push", async () => {
    vi.mocked(getAllEntries).mockResolvedValue([]);

    const result = await pushEntries({
      key: fakeKey,
      token: "tok",
      config: makeConfig({ lastSyncAt: 9999 }),
      dirtyIds: new Set(),
      deletedIds: new Set(),
      forceAll: false,
    });

    expect(result).toBeNull();
    expect(apiPushEntries).not.toHaveBeenCalled();
  });
});

// =================== pullEntries ===================

describe("pullEntries", () => {
  it("pulls entries and advances cursor to last entry's serverSeq", async () => {
    const entries = [makeSyncEntry("e1", 1), makeSyncEntry("e2", 2), makeSyncEntry("e3", 3)];
    vi.mocked(apiPullEntries).mockResolvedValue({
      entries,
      serverSeq: 100,
      hasMore: false,
    });

    const result = await pullEntries({
      key: fakeKey,
      token: "tok",
      config: makeConfig({ lastSyncSeq: 0 }),
    });

    // Cursor should advance to global max since hasMore = false
    expect(result.serverSeq).toBe(100);
    expect(result.hadEntries).toBe(true);
    expect(decryptEntry).toHaveBeenCalledTimes(3);
    expect(mergeRemoteEntries).toHaveBeenCalledTimes(1);
  });

  it("paginates correctly using per-page cursor (not global)", async () => {
    // Page 1: entries with seq 1-3, global seq = 10, hasMore = true
    vi.mocked(apiPullEntries)
      .mockResolvedValueOnce({
        entries: [makeSyncEntry("e1", 1), makeSyncEntry("e2", 2), makeSyncEntry("e3", 3)],
        serverSeq: 10,
        hasMore: true,
      })
      // Page 2: entries with seq 4-6, global seq = 10, hasMore = false
      .mockResolvedValueOnce({
        entries: [makeSyncEntry("e4", 4), makeSyncEntry("e5", 5), makeSyncEntry("e6", 6)],
        serverSeq: 10,
        hasMore: false,
      });

    const result = await pullEntries({
      key: fakeKey,
      token: "tok",
      config: makeConfig({ lastSyncSeq: 0 }),
    });

    // Should have made 2 API calls
    expect(apiPullEntries).toHaveBeenCalledTimes(2);
    // First call: since=0
    expect(vi.mocked(apiPullEntries).mock.calls[0][1]).toBe(0);
    // Second call: since=3 (last entry's serverSeq from page 1, NOT 10)
    expect(vi.mocked(apiPullEntries).mock.calls[1][1]).toBe(3);
    // Final seq should be global max
    expect(result.serverSeq).toBe(10);
    expect(result.hadEntries).toBe(true);
  });

  it("breaks on stuck cursor to prevent infinite loop", async () => {
    // Entries with no serverSeq advancement
    const stuckEntry: SyncEntry = {
      id: "stuck",
      updatedAt: 1000,
      isArchived: false,
      isDeleted: false,
      encryptedPayload: "enc",
      integrityHash: "hash",
      // serverSeq is 0 — won't advance past since=0
      serverSeq: 0,
    };

    vi.mocked(apiPullEntries).mockResolvedValue({
      entries: [stuckEntry],
      serverSeq: 10,
      hasMore: true,
    });

    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    const result = await pullEntries({
      key: fakeKey,
      token: "tok",
      config: makeConfig({ lastSyncSeq: 0 }),
    });

    // Should break after first page due to stuck cursor
    expect(apiPullEntries).toHaveBeenCalledTimes(1);
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining("cursor stuck"));
    // Still advances to global seq after breaking
    expect(result.serverSeq).toBe(10);

    warnSpy.mockRestore();
  });

  it("handles per-entry decryption failures gracefully", async () => {
    const entries = [makeSyncEntry("good", 1), makeSyncEntry("bad", 2), makeSyncEntry("good2", 3)];

    vi.mocked(decryptEntry)
      .mockResolvedValueOnce({ id: "good", dayKey: "2025-06-15", createdAt: 1000, updatedAt: 2000, blocks: [], isArchived: false, isDeleted: false, tags: [] })
      .mockRejectedValueOnce(new Error("Decryption failed"))
      .mockResolvedValueOnce({ id: "good2", dayKey: "2025-06-15", createdAt: 1000, updatedAt: 2000, blocks: [], isArchived: false, isDeleted: false, tags: [] });

    vi.mocked(apiPullEntries).mockResolvedValue({
      entries,
      serverSeq: 3,
      hasMore: false,
    });

    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    await pullEntries({
      key: fakeKey,
      token: "tok",
      config: makeConfig(),
    });

    // mergeRemoteEntries should receive only the 2 successfully decrypted entries
    expect(mergeRemoteEntries).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ id: "good" }),
        expect.objectContaining({ id: "good2" }),
      ]),
    );
    const mergedEntries = vi.mocked(mergeRemoteEntries).mock.calls[0][0];
    expect(mergedEntries).toHaveLength(2);

    warnSpy.mockRestore();
  });

  it("returns hadEntries = false when no entries received", async () => {
    vi.mocked(apiPullEntries).mockResolvedValue({
      entries: [],
      serverSeq: 5,
      hasMore: false,
    });

    const result = await pullEntries({
      key: fakeKey,
      token: "tok",
      config: makeConfig({ lastSyncSeq: 5 }),
    });

    expect(result.hadEntries).toBe(false);
    expect(mergeRemoteEntries).not.toHaveBeenCalled();
  });

  it("uses config.lastSyncSeq as initial cursor", async () => {
    vi.mocked(apiPullEntries).mockResolvedValue({
      entries: [],
      serverSeq: 50,
      hasMore: false,
    });

    await pullEntries({
      key: fakeKey,
      token: "tok",
      config: makeConfig({ lastSyncSeq: 42 }),
    });

    expect(vi.mocked(apiPullEntries).mock.calls[0][1]).toBe(42);
  });

  it("calls onPhaseChange when entries are received", async () => {
    vi.mocked(apiPullEntries).mockResolvedValue({
      entries: [makeSyncEntry("e1", 1)],
      serverSeq: 1,
      hasMore: false,
    });

    const onPhaseChange = vi.fn();

    await pullEntries({
      key: fakeKey,
      token: "tok",
      config: makeConfig(),
      onPhaseChange,
    });

    expect(onPhaseChange).toHaveBeenCalledWith("merging");
  });
});
