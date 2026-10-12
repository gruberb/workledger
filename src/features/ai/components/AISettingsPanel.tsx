import { useState, useEffect, useRef, useCallback } from "react";
import type { AISettings } from "../types/ai.ts";
import type { AIConnectionStatus } from "../hooks/useAIFeatureGate.ts";
import type { LLMProvider } from "../providers/types.ts";
import { validateServerUrl } from "../providers/url.ts";
import { pickProviderDraft, savableUpdates, type ProviderDraft } from "../utils/provider-draft.ts";
import { ProviderFields } from "./ProviderFields.tsx";

// Typing in URL and API key fields should not persist (and re-ping the
// provider) on every keystroke.
const SAVE_DEBOUNCE_MS = 500;

const STATUS_DISPLAY: Record<AIConnectionStatus, { dot: string; label: string }> = {
  connected: { dot: "bg-green-500", label: "Connected" },
  disconnected: { dot: "bg-red-400", label: "Disconnected" },
  unconfigured: { dot: "bg-red-400", label: "Not configured" },
  checking: { dot: "bg-gray-300", label: "Checking..." },
  disabled: { dot: "bg-gray-300", label: "Disabled" },
};

interface AISettingsPanelProps {
  settings: AISettings;
  onUpdateSettings: (updates: Partial<AISettings>) => Promise<void>;
  status: AIConnectionStatus;
  configError: string | null;
  provider: LLMProvider | null;
}

export function AISettingsPanel({ settings, onUpdateSettings, status, configError, provider }: AISettingsPanelProps) {
  const [draft, setDraft] = useState<ProviderDraft>(() => pickProviderDraft(settings));
  const [models, setModels] = useState<string[]>([]);
  const pendingRef = useRef<Partial<ProviderDraft>>({});
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const flush = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = null;
    const updates = savableUpdates(pendingRef.current, (url) => !validateServerUrl(url));
    pendingRef.current = {};
    if (Object.keys(updates).length > 0) onUpdateSettings(updates);
  }, [onUpdateSettings]);

  useEffect(() => flush, [flush]);

  const handleDraftChange = useCallback((updates: Partial<ProviderDraft>) => {
    setDraft((prev) => ({ ...prev, ...updates }));
    pendingRef.current = { ...pendingRef.current, ...updates };
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(flush, SAVE_DEBOUNCE_MS);
  }, [flush]);

  useEffect(() => {
    let cancelled = false;
    // Clear the previous provider's list so a stale model list is never offered.
    Promise.resolve(provider?.listModels?.() ?? []).then((m) => { if (!cancelled) setModels(m); });
    return () => { cancelled = true; };
  }, [provider]);

  const display = STATUS_DISPLAY[status];

  return (
    <div className="px-4 py-4 overflow-y-auto h-full">
      <div className="flex items-center justify-end mb-4">
        <div className="flex items-center gap-1.5" title={configError ?? undefined}>
          <span className={`w-2 h-2 rounded-full ${display.dot}`} />
          <span className="text-[10px] text-gray-400">{display.label}</span>
        </div>
      </div>

      <div className="space-y-4">
        <div>
          <label className="text-xs text-gray-500 dark:text-gray-400 block mb-1">Provider</label>
          <select
            value={settings.provider}
            onChange={(e) => { flush(); onUpdateSettings({ provider: e.target.value as AISettings["provider"] }); }}
            className="w-full text-sm border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 outline-none focus:border-orange-300 bg-white dark:bg-[#1a1a1a] dark:text-gray-300"
          >
            <option value="ollama">Ollama (Local)</option>
            <option value="anthropic">Anthropic</option>
            <option value="openai">OpenAI</option>
            <option value="openrouter">OpenRouter</option>
            <option value="huggingface">Hugging Face</option>
            <option value="custom">Custom Server</option>
          </select>
        </div>

        <ProviderFields provider={settings.provider} values={draft} onChange={handleDraftChange} models={models} />

        {provider?.supportsWebSearch && (
          <label className="flex items-start gap-2 text-xs text-gray-600 dark:text-gray-300 cursor-pointer">
            <input
              type="checkbox"
              checked={settings.webSearch}
              onChange={(e) => onUpdateSettings({ webSearch: e.target.checked })}
              className="mt-0.5 accent-orange-500"
            />
            <span>
              Web search for research actions
              <span className="block text-[10px] text-gray-400">Billed by the provider per search. Results link their sources.</span>
            </span>
          </label>
        )}

        <div className="border-t border-gray-100 dark:border-gray-800" />

        <div>
          <label className="text-xs text-gray-500 dark:text-gray-400 block mb-1">
            Temperature: {settings.temperature.toFixed(1)}
          </label>
          <input
            type="range"
            min="0"
            max="1"
            step="0.1"
            value={settings.temperature}
            onChange={(e) => onUpdateSettings({ temperature: parseFloat(e.target.value) })}
            className="w-full accent-orange-500"
          />
          <div className="flex justify-between text-[10px] text-gray-400">
            <span>Focused</span>
            <span>Creative</span>
          </div>
        </div>

        <div>
          <label className="text-xs text-gray-500 dark:text-gray-400 block mb-1">
            Max tokens: {settings.maxTokens}
          </label>
          <input
            type="range"
            min="256"
            max="4096"
            step="256"
            value={settings.maxTokens}
            onChange={(e) => onUpdateSettings({ maxTokens: parseInt(e.target.value) })}
            className="w-full accent-orange-500"
          />
          <div className="flex justify-between text-[10px] text-gray-400">
            <span>Shorter</span>
            <span>Longer</span>
          </div>
        </div>
      </div>
    </div>
  );
}
