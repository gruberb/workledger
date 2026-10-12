import { getDB } from "../../../storage/db.ts";
import { DEFAULT_AI_SETTINGS, type AISettings } from "../types/ai.ts";

const PREFIX = "ai.";

export async function loadAISettings(): Promise<AISettings> {
  const db = await getDB();
  const settings = { ...DEFAULT_AI_SETTINGS };

  // Values are stored as strings; the default's type says how to read each one back,
  // so a new setting only needs a default.
  const values = settings as unknown as Record<string, string | number | boolean>;
  for (const key of Object.keys(DEFAULT_AI_SETTINGS)) {
    const row = await db.get("settings", PREFIX + key);
    if (!row) continue;
    const fallback = values[key];
    if (typeof fallback === "boolean") values[key] = row.value === "true";
    else if (typeof fallback === "number") values[key] = Number(row.value);
    else values[key] = row.value;
  }

  return settings;
}

export async function saveAISettings(settings: Partial<AISettings>): Promise<void> {
  const db = await getDB();
  const tx = db.transaction("settings", "readwrite");

  for (const [key, value] of Object.entries(settings)) {
    await tx.store.put({ key: PREFIX + key, value: String(value) });
  }

  await tx.done;
}
