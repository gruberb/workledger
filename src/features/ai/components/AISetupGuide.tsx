import { useState } from "react";
import type { AISettings, AIProviderType } from "../types/ai.ts";
import { createProvider } from "../providers/provider-factory.ts";

function isNonLocalHttp(url: string): boolean {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "http:") return false;
    const host = parsed.hostname;
    return host !== "localhost" && host !== "127.0.0.1" && host !== "[::1]";
  } catch {
    return false;
  }
}

interface AISetupGuideProps {
  settings: AISettings;
  onUpdateSettings: (updates: Partial<AISettings>) => Promise<void>;
}

type Tab = "ollama" | "huggingface" | "custom";

export function AISetupGuide({ settings, onUpdateSettings }: AISetupGuideProps) {
  const [activeTab, setActiveTab] = useState<Tab>(settings.provider);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<"success" | "error" | null>(null);

  // Local form state
  const [ollamaUrl, setOllamaUrl] = useState(settings.ollamaUrl);
  const [ollamaModel, setOllamaModel] = useState(settings.ollamaModel);
  const [hfApiKey, setHfApiKey] = useState(settings.hfApiKey);
  const [hfModel, setHfModel] = useState(settings.hfModel);
  const [customUrl, setCustomUrl] = useState(settings.customUrl);
  const [customApiKey, setCustomApiKey] = useState(settings.customApiKey);
  const [customModel, setCustomModel] = useState(settings.customModel);

  const testConnection = async (providerType: AIProviderType) => {
    setTesting(true);
    setTestResult(null);

    const testSettings: AISettings = {
      ...settings,
      provider: providerType,
      ollamaUrl,
      ollamaModel,
      hfApiKey,
      hfModel,
      customUrl,
      customApiKey,
      customModel,
    };

    const provider = createProvider(testSettings);
    if (!provider) {
      setTestResult("error");
      setTesting(false);
      return;
    }

    const ok = await provider.ping();
    setTestResult(ok ? "success" : "error");
    setTesting(false);
  };

  const saveAndConnect = async (providerType: AIProviderType) => {
    await onUpdateSettings({
      provider: providerType,
      ollamaUrl,
      ollamaModel,
      hfApiKey,
      hfModel,
      customUrl,
      customApiKey,
      customModel,
    });
  };

  const tabs: { id: Tab; label: string }[] = [
    { id: "ollama", label: "Local (Ollama)" },
    { id: "huggingface", label: "Hugging Face" },
    { id: "custom", label: "Custom Server" },
  ];

  return (
    <div className="px-4 py-4 overflow-y-auto h-full">
      <h3 className="text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">Set up AI Provider</h3>
      <p className="text-xs text-gray-400 mb-4">
        Connect to a local or remote LLM to power thinking frameworks.
      </p>

      {/* Tabs */}
      <div className="flex border-b border-gray-100 dark:border-gray-800 mb-4">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => { setActiveTab(tab.id); setTestResult(null); }}
            className={`
              text-xs px-3 py-2 -mb-px transition-colors
              ${activeTab === tab.id
                ? "border-b-2 border-orange-500 text-orange-600 dark:text-orange-400 font-medium"
                : "text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              }
            `}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Ollama tab */}
      {activeTab === "ollama" && (
        <div className="space-y-4">
          <div className="bg-gray-50 dark:bg-gray-900 rounded-xl p-3">
            <p className="text-xs text-gray-600 dark:text-gray-300 font-medium mb-2">Quick setup:</p>
            <ol className="text-xs text-gray-500 space-y-1.5 list-decimal list-inside">
              <li>Install Ollama from <span className="text-orange-600 font-medium">ollama.com</span></li>
              <li>Run <code className="px-1.5 py-0.5 bg-gray-200 dark:bg-gray-700 rounded text-[11px]">ollama pull mistral</code> in terminal</li>
              <li>Ollama starts automatically on localhost:11434</li>
            </ol>
          </div>
          <div>
            <label className="text-xs text-gray-500 dark:text-gray-400 block mb-1">Server URL</label>
            <input
              type="text"
              value={ollamaUrl}
              onChange={(e) => setOllamaUrl(e.target.value)}
              placeholder="http://localhost:11434"
              className="w-full text-sm border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 outline-none focus:border-orange-300 focus:ring-1 focus:ring-orange-100 dark:focus:ring-orange-900 bg-white dark:bg-[#1a1a1a] dark:text-gray-300"
            />
            {isNonLocalHttp(ollamaUrl) && (
              <p className="text-[10px] text-amber-500 mt-1">Warning: Using unencrypted HTTP to a non-local server.</p>
            )}
          </div>
          <div>
            <label className="text-xs text-gray-500 dark:text-gray-400 block mb-1">Model name</label>
            <input
              type="text"
              value={ollamaModel}
              onChange={(e) => setOllamaModel(e.target.value)}
              placeholder="mistral"
              className="w-full text-sm border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 outline-none focus:border-orange-300 focus:ring-1 focus:ring-orange-100 dark:focus:ring-orange-900 bg-white dark:bg-[#1a1a1a] dark:text-gray-300"
            />
            <p className="text-[10px] text-gray-400 mt-1">e.g. mistral, llama3.1, phi3, qwen2.5</p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => testConnection("ollama")}
              disabled={testing}
              className="flex-1 py-2 text-sm rounded-lg border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-50 transition-colors"
            >
              {testing ? "Testing..." : "Test Connection"}
            </button>
            <button
              onClick={() => saveAndConnect("ollama")}
              className="flex-1 py-2 text-sm rounded-lg bg-orange-500 text-white hover:bg-orange-600 transition-colors"
            >
              Save & Connect
            </button>
          </div>
          <TestResultBadge result={testResult} />
        </div>
      )}

      {/* Hugging Face tab */}
      {activeTab === "huggingface" && (
        <div className="space-y-4">
          <div className="bg-gray-50 dark:bg-gray-900 rounded-xl p-3">
            <p className="text-xs text-gray-600 dark:text-gray-300 font-medium mb-2">Quick setup:</p>
            <ol className="text-xs text-gray-500 space-y-1.5 list-decimal list-inside">
              <li>Create a free account at <span className="text-orange-600 font-medium">huggingface.co</span></li>
              <li>Go to Settings &gt; Access Tokens</li>
              <li>Create a token and paste it below</li>
            </ol>
          </div>
          <div>
            <label className="text-xs text-gray-500 dark:text-gray-400 block mb-1">API Key</label>
            <input
              type="password"
              value={hfApiKey}
              onChange={(e) => setHfApiKey(e.target.value)}
              placeholder="hf_..."
              className="w-full text-sm border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 outline-none focus:border-orange-300 focus:ring-1 focus:ring-orange-100 dark:focus:ring-orange-900 bg-white dark:bg-[#1a1a1a] dark:text-gray-300"
            />
            <p className="text-[10px] text-gray-400 mt-1">Stored unencrypted in this browser.</p>
          </div>
          <div>
            <label className="text-xs text-gray-500 dark:text-gray-400 block mb-1">Model</label>
            <select
              value={hfModel}
              onChange={(e) => setHfModel(e.target.value)}
              className="w-full text-sm border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 outline-none focus:border-orange-300 focus:ring-1 focus:ring-orange-100 dark:focus:ring-orange-900 bg-white dark:bg-[#1a1a1a] dark:text-gray-300"
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
          <div className="flex gap-2">
            <button
              onClick={() => testConnection("huggingface")}
              disabled={testing || !hfApiKey}
              className="flex-1 py-2 text-sm rounded-lg border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-50 transition-colors"
            >
              {testing ? "Testing..." : "Test Connection"}
            </button>
            <button
              onClick={() => saveAndConnect("huggingface")}
              disabled={!hfApiKey}
              className="flex-1 py-2 text-sm rounded-lg bg-orange-500 text-white hover:bg-orange-600 disabled:opacity-50 transition-colors"
            >
              Save & Connect
            </button>
          </div>
          <TestResultBadge result={testResult} />
        </div>
      )}

      {/* Custom server tab */}
      {activeTab === "custom" && (
        <div className="space-y-4">
          <div className="bg-gray-50 dark:bg-gray-900 rounded-xl p-3">
            <p className="text-xs text-gray-600 dark:text-gray-300 font-medium mb-2">Connect to any OpenAI-compatible server:</p>
            <p className="text-xs text-gray-500">
              Works with vLLM, text-generation-inference, llama.cpp server, or remote Ollama.
              Any server exposing <code className="px-1 py-0.5 bg-gray-200 dark:bg-gray-700 rounded text-[10px]">/v1/chat/completions</code>.
            </p>
          </div>
          <div>
            <label className="text-xs text-gray-500 dark:text-gray-400 block mb-1">Base URL</label>
            <input
              type="text"
              value={customUrl}
              onChange={(e) => setCustomUrl(e.target.value)}
              placeholder="https://your-server.com"
              className="w-full text-sm border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 outline-none focus:border-orange-300 focus:ring-1 focus:ring-orange-100 dark:focus:ring-orange-900 bg-white dark:bg-[#1a1a1a] dark:text-gray-300"
            />
            {isNonLocalHttp(customUrl) && (
              <p className="text-[10px] text-amber-500 mt-1">Warning: Using unencrypted HTTP to a non-local server.</p>
            )}
          </div>
          <div>
            <label className="text-xs text-gray-500 dark:text-gray-400 block mb-1">API Key (optional)</label>
            <input
              type="password"
              value={customApiKey}
              onChange={(e) => setCustomApiKey(e.target.value)}
              placeholder="sk-..."
              className="w-full text-sm border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 outline-none focus:border-orange-300 focus:ring-1 focus:ring-orange-100 dark:focus:ring-orange-900 bg-white dark:bg-[#1a1a1a] dark:text-gray-300"
            />
            <p className="text-[10px] text-gray-400 mt-1">Stored unencrypted in this browser.</p>
          </div>
          <div>
            <label className="text-xs text-gray-500 dark:text-gray-400 block mb-1">Model name</label>
            <input
              type="text"
              value={customModel}
              onChange={(e) => setCustomModel(e.target.value)}
              placeholder="e.g. mistral, gpt-4"
              className="w-full text-sm border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 outline-none focus:border-orange-300 focus:ring-1 focus:ring-orange-100 dark:focus:ring-orange-900 bg-white dark:bg-[#1a1a1a] dark:text-gray-300"
            />
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => testConnection("custom")}
              disabled={testing || !customUrl || !customModel}
              className="flex-1 py-2 text-sm rounded-lg border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-50 transition-colors"
            >
              {testing ? "Testing..." : "Test Connection"}
            </button>
            <button
              onClick={() => saveAndConnect("custom")}
              disabled={!customUrl || !customModel}
              className="flex-1 py-2 text-sm rounded-lg bg-orange-500 text-white hover:bg-orange-600 disabled:opacity-50 transition-colors"
            >
              Save & Connect
            </button>
          </div>
          <TestResultBadge result={testResult} />
        </div>
      )}
    </div>
  );
}

function TestResultBadge({ result }: { result: "success" | "error" | null }) {
  if (!result) return null;
  return (
    <div
      className={`
        text-xs px-3 py-2 rounded-lg text-center
        ${result === "success"
          ? "bg-green-50 dark:bg-green-950 text-green-600 dark:text-green-400 border border-green-100 dark:border-green-800"
          : "bg-red-50 dark:bg-red-950 text-red-600 dark:text-red-400 border border-red-100 dark:border-red-800"
        }
      `}
    >
      {result === "success" ? "Connected successfully!" : "Connection failed. Check settings and try again."}
    </div>
  );
}
