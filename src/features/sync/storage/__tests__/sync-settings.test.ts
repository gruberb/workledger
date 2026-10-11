import { describe, it, expect, vi, beforeEach } from "vitest";
import { loadSyncConfig, loadTombstones, saveTombstones } from "../sync-settings.ts";
import { DEFAULT_SYNC_CONFIG } from "../../types/sync.ts";

const settings = new Map<string, { key: string; value: string }>();

vi.mock("../../../../storage/db.ts", () => ({
  getDB: async () => ({
    get: async (_store: string, key: string) => settings.get(key),
    put: async (_store: string, row: { key: string; value: string }) => { settings.set(row.key, row); },
    delete: async (_store: string, key: string) => { settings.delete(key); },
  }),
}));

function storeConfig(value: unknown) {
  settings.set("sync-config", { key: "sync-config", value: JSON.stringify(value) });
}

beforeEach(() => settings.clear());

describe("loadSyncConfig", () => {
  it("falls back per field instead of resetting the account", async () => {
    storeConfig({ mode: "remote", syncId: "wl-x", salt: "s", lastSyncSeq: "garbage", lastPullAt: 5 });
    expect(await loadSyncConfig()).toEqual({
      ...DEFAULT_SYNC_CONFIG, mode: "remote", syncId: "wl-x", salt: "s", lastSyncSeq: 0, lastPullAt: 5,
    });
  });

  it("clears lastSyncAt from configs written before lastPullAt existed", async () => {
    storeConfig({ mode: "remote", syncId: "wl-x", salt: "s", serverUrl: null, lastSyncSeq: 7, lastSyncAt: 123 });
    const config = await loadSyncConfig();
    expect(config.lastSyncAt).toBeNull();
    expect(config.lastSyncSeq).toBe(7);
  });

  it("returns defaults for unparsable JSON", async () => {
    settings.set("sync-config", { key: "sync-config", value: "{nope" });
    expect(await loadSyncConfig()).toEqual(DEFAULT_SYNC_CONFIG);
  });
});

describe("tombstones", () => {
  it("round-trips and removes the row when empty", async () => {
    await saveTombstones(["a", "b"]);
    expect(await loadTombstones()).toEqual(["a", "b"]);
    await saveTombstones([]);
    expect(settings.has("sync-tombstones")).toBe(false);
    expect(await loadTombstones()).toEqual([]);
  });
});
