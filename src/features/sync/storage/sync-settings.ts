import { z } from "zod";
import { getDB } from "../../../storage/db.ts";
import { DEFAULT_SYNC_CONFIG, type SyncConfig } from "../types/sync.ts";

const SETTINGS_KEY = "sync-config";
const TOMBSTONES_KEY = "sync-tombstones";

// Each field falls back on its own, so one bad or missing field (e.g. a config
// written by an older version) doesn't reset the whole account.
const syncConfigSchema = z.object({
  mode: z.enum(["local", "remote"]).catch(DEFAULT_SYNC_CONFIG.mode),
  syncId: z.string().nullable().catch(null),
  salt: z.string().nullable().catch(null),
  serverUrl: z.string().nullable().catch(null),
  lastSyncSeq: z.number().int().nonnegative().catch(0),
  lastSyncAt: z.number().nullable().catch(null),
  lastPullAt: z.number().nullable().catch(null),
});

export async function loadSyncConfig(): Promise<SyncConfig> {
  const db = await getDB();
  const row = await db.get("settings", SETTINGS_KEY);
  if (!row) return { ...DEFAULT_SYNC_CONFIG };
  try {
    const raw = JSON.parse(row.value);
    const config = syncConfigSchema.parse(raw);
    // Configs written before lastPullAt existed had lastSyncAt advanced by pulls,
    // which can hide unpushed edits. Clearing it makes the next push rescan everything once.
    if (!("lastPullAt" in raw)) config.lastSyncAt = null;
    return config;
  } catch {
    return { ...DEFAULT_SYNC_CONFIG };
  }
}

export async function saveSyncConfig(config: SyncConfig): Promise<void> {
  const db = await getDB();
  await db.put("settings", { key: SETTINGS_KEY, value: JSON.stringify(config) });
}

export async function clearSyncConfig(): Promise<void> {
  const db = await getDB();
  await db.delete("settings", SETTINGS_KEY);
}

/**
 * Ids of locally deleted entries not yet pushed. Persisted because the entry
 * row is gone, so nothing else can reconstruct the delete after a reload.
 */
export async function loadTombstones(): Promise<string[]> {
  const db = await getDB();
  const row = await db.get("settings", TOMBSTONES_KEY);
  if (!row) return [];
  try {
    return z.array(z.string()).parse(JSON.parse(row.value));
  } catch {
    return [];
  }
}

export async function saveTombstones(ids: string[]): Promise<void> {
  const db = await getDB();
  if (ids.length === 0) {
    await db.delete("settings", TOMBSTONES_KEY);
  } else {
    await db.put("settings", { key: TOMBSTONES_KEY, value: JSON.stringify(ids) });
  }
}

export interface SyncStorage {
  loadConfig: () => Promise<SyncConfig>;
  saveConfig: (config: SyncConfig) => Promise<void>;
  clearConfig: () => Promise<void>;
  loadTombstones: () => Promise<string[]>;
  saveTombstones: (ids: string[]) => Promise<void>;
}

export const idbSyncStorage: SyncStorage = {
  loadConfig: loadSyncConfig,
  saveConfig: saveSyncConfig,
  clearConfig: clearSyncConfig,
  loadTombstones,
  saveTombstones,
};
