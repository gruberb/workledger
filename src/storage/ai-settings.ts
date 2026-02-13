import { getDB } from "./db.ts";
import { DEFAULT_AI_SETTINGS, type AISettings } from "../types/ai.ts";

const PREFIX = "ai.";

export async function loadAISettings(): Promise<AISettings> {
  const db = await getDB();
  const settings = { ...DEFAULT_AI_SETTINGS };

  const keys: (keyof AISettings)[] = [
    "enabled", "provider",
    "ollamaUrl", "ollamaModel",
    "hfApiKey", "hfModel",
    "customUrl", "customApiKey", "customModel",
    "temperature", "maxTokens",
  ];

  for (const key of keys) {
    const row = await db.get("settings", PREFIX + key);
    if (row) {
      const val = row.value;
      if (key === "enabled") {
        settings[key] = val === "true";
      } else if (key === "temperature" || key === "maxTokens") {
        settings[key] = Number(val);
      } else {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (settings as any)[key] = val;
      }
    }
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
