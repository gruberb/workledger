import { useState, useEffect, useCallback } from "react";
import type { AISettings } from "../types/ai.ts";
import { DEFAULT_AI_SETTINGS } from "../types/ai.ts";
import { loadAISettings, saveAISettings } from "../storage/ai-settings.ts";

export function useAISettings() {
  const [settings, setSettings] = useState<AISettings>(DEFAULT_AI_SETTINGS);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadAISettings().then((s) => {
      setSettings(s);
      setLoading(false);
    });
  }, []);

  const updateSettings = useCallback(async (updates: Partial<AISettings>) => {
    await saveAISettings(updates);
    setSettings((prev) => ({ ...prev, ...updates }));
  }, []);

  return { settings, updateSettings, loading };
}
