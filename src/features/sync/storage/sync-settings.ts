import { getDB } from "../../../storage/db.ts";
import { DEFAULT_SYNC_CONFIG, type SyncConfig } from "../types/sync.ts";

const SETTINGS_KEY = "sync-config";

export async function loadSyncConfig(): Promise<SyncConfig> {
  const db = await getDB();
  const row = await db.get("settings", SETTINGS_KEY);
  if (!row) return { ...DEFAULT_SYNC_CONFIG };
  try {
    return JSON.parse(row.value) as SyncConfig;
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
