import { useState, useEffect, useMemo } from "react";
import type { AISettings } from "../types/ai.ts";
import { createProvider } from "../providers/provider-factory.ts";

interface AISettingsPanelProps {
  settings: AISettings;
  onUpdateSettings: (updates: Partial<AISettings>) => Promise<void>;
}

export function AISettingsPanel({ settings, onUpdateSettings }: AISettingsPanelProps) {
  const [pingResult, setPingResult] = useState<{ provider: unknown; ok: boolean } | null>(null);
  const [models, setModels] = useState<string[]>([]);

  const provider = useMemo(() => createProvider(settings), [settings]);
  const connected = !provider ? false : pingResult?.provider === provider ? pingResult.ok : null;

  useEffect(() => {
    if (!provider) return;
    provider.ping().then((ok) => setPingResult({ provider, ok }));
    provider.listModels().then(setModels);
  }, [provider]);

  return (
    <div className="px-4 py-4 overflow-y-auto h-full">
      <div className="flex items-center justify-end mb-4">
        <div className="flex items-center gap-1.5">
          <span
            className={`w-2 h-2 rounded-full ${
              connected === true ? "bg-green-500" : connected === false ? "bg-red-400" : "bg-gray-300"
            }`}
          />
          <span className="text-[10px] text-gray-400">
            {connected === true ? "Connected" : connected === false ? "Disconnected" : "Checking..."}
          </span>
        </div>
      </div>

      <div className="space-y-4">
        {/* Provider */}
        <div>
          <label className="text-xs text-gray-500 dark:text-gray-400 block mb-1">Provider</label>
          <select
            value={settings.provider}
            onChange={(e) => onUpdateSettings({ provider: e.target.value as AISettings["provider"] })}
            className="w-full text-sm border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 outline-none focus:border-orange-300 bg-white dark:bg-[#1a1a1a] dark:text-gray-300"
          >
            <option value="ollama">Ollama (Local)</option>
            <option value="huggingface">Hugging Face</option>
            <option value="custom">Custom Server</option>
          </select>
        </div>

        {/* Provider-specific fields */}
        {settings.provider === "ollama" && (
          <>
            <div>
              <label className="text-xs text-gray-500 dark:text-gray-400 block mb-1">Server URL</label>
              <input
                type="text"
                value={settings.ollamaUrl}
                onChange={(e) => onUpdateSettings({ ollamaUrl: e.target.value })}
                className="w-full text-sm border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 outline-none focus:border-orange-300 bg-white dark:bg-[#1a1a1a] dark:text-gray-300"
              />
            </div>
            <div>
              <label className="text-xs text-gray-500 dark:text-gray-400 block mb-1">Model</label>
              {models.length > 0 ? (
                <select
                  value={settings.ollamaModel}
                  onChange={(e) => onUpdateSettings({ ollamaModel: e.target.value })}
                  className="w-full text-sm border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 outline-none focus:border-orange-300 bg-white dark:bg-[#1a1a1a] dark:text-gray-300"
                >
                  {models.map((m) => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </select>
              ) : (
                <input
                  type="text"
                  value={settings.ollamaModel}
                  onChange={(e) => onUpdateSettings({ ollamaModel: e.target.value })}
                  className="w-full text-sm border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 outline-none focus:border-orange-300 bg-white dark:bg-[#1a1a1a] dark:text-gray-300"
                />
              )}
            </div>
          </>
        )}

        {settings.provider === "huggingface" && (
          <>
            <div>
              <label className="text-xs text-gray-500 dark:text-gray-400 block mb-1">API Key</label>
              <input
                type="password"
                value={settings.hfApiKey}
                onChange={(e) => onUpdateSettings({ hfApiKey: e.target.value })}
                className="w-full text-sm border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 outline-none focus:border-orange-300 bg-white dark:bg-[#1a1a1a] dark:text-gray-300"
              />
            </div>
            <div>
              <label className="text-xs text-gray-500 dark:text-gray-400 block mb-1">Model</label>
              <select
                value={settings.hfModel}
                onChange={(e) => onUpdateSettings({ hfModel: e.target.value })}
                className="w-full text-sm border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 outline-none focus:border-orange-300 bg-white dark:bg-[#1a1a1a] dark:text-gray-300"
              >
                <option value="Qwen/Qwen2.5-7B-Instruct">Qwen 2.5 7B Instruct</option>
                <option value="meta-llama/Llama-3.1-8B-Instruct">Llama 3.1 8B Instruct</option>
                <option value="meta-llama/Llama-3.2-3B-Instruct">Llama 3.2 3B Instruct</option>
                <option value="Qwen/Qwen3-8B">Qwen 3 8B</option>
                <option value="Qwen/Qwen3-4B-Instruct-2507">Qwen 3 4B Instruct</option>
                <option value="meta-llama/Meta-Llama-3-8B-Instruct">Llama 3 8B Instruct</option>
                <option value="deepseek-ai/DeepSeek-R1-Distill-Qwen-7B">DeepSeek R1 Distill 7B</option>
              </select>
            </div>
          </>
        )}

        {settings.provider === "custom" && (
          <>
            <div>
              <label className="text-xs text-gray-500 block mb-1">Base URL</label>
              <input
                type="text"
                value={settings.customUrl}
                onChange={(e) => onUpdateSettings({ customUrl: e.target.value })}
                className="w-full text-sm border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 outline-none focus:border-orange-300 bg-white dark:bg-[#1a1a1a] dark:text-gray-300"
              />
            </div>
            <div>
              <label className="text-xs text-gray-500 block mb-1">API Key (optional)</label>
              <input
                type="password"
                value={settings.customApiKey}
                onChange={(e) => onUpdateSettings({ customApiKey: e.target.value })}
                className="w-full text-sm border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 outline-none focus:border-orange-300 bg-white dark:bg-[#1a1a1a] dark:text-gray-300"
              />
            </div>
            <div>
              <label className="text-xs text-gray-500 block mb-1">Model name</label>
              <input
                type="text"
                value={settings.customModel}
                onChange={(e) => onUpdateSettings({ customModel: e.target.value })}
                className="w-full text-sm border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 outline-none focus:border-orange-300 bg-white dark:bg-[#1a1a1a] dark:text-gray-300"
              />
            </div>
          </>
        )}

        {/* Divider */}
        <div className="border-t border-gray-100 dark:border-gray-800" />

        {/* Temperature */}
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

        {/* Max tokens */}
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
