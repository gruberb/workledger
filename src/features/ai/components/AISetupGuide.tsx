import { useState, type ReactNode } from "react";
import type { AISettings, AIProviderType } from "../types/ai.ts";
import { createProvider, getProviderConfigError } from "../providers/provider-factory.ts";
import { pickProviderDraft, type ProviderDraft } from "../utils/provider-draft.ts";
import { ProviderFields } from "./ProviderFields.tsx";

interface AISetupGuideProps {
  settings: AISettings;
  onUpdateSettings: (updates: Partial<AISettings>) => Promise<void>;
}

const TABS: { id: AIProviderType; label: string }[] = [
  { id: "ollama", label: "Local (Ollama)" },
  { id: "huggingface", label: "Hugging Face" },
  { id: "custom", label: "Custom Server" },
];

const codeClass = "px-1.5 py-0.5 bg-gray-200 dark:bg-gray-700 rounded text-[11px]";

const INSTRUCTIONS: Record<AIProviderType, ReactNode> = {
  ollama: (
    <>
      <p className="text-xs text-gray-600 dark:text-gray-300 font-medium mb-2">Quick setup:</p>
      <ol className="text-xs text-gray-500 space-y-1.5 list-decimal list-inside">
        <li>Install Ollama from <span className="text-orange-600 font-medium">ollama.com</span></li>
        <li>Run <code className={codeClass}>ollama pull mistral</code> in terminal</li>
        <li>Ollama starts automatically on localhost:11434</li>
      </ol>
    </>
  ),
  huggingface: (
    <>
      <p className="text-xs text-gray-600 dark:text-gray-300 font-medium mb-2">Quick setup:</p>
      <ol className="text-xs text-gray-500 space-y-1.5 list-decimal list-inside">
        <li>Create a free account at <span className="text-orange-600 font-medium">huggingface.co</span></li>
        <li>Go to Settings &gt; Access Tokens</li>
        <li>Create a token and paste it below</li>
      </ol>
    </>
  ),
  custom: (
    <>
      <p className="text-xs text-gray-600 dark:text-gray-300 font-medium mb-2">Connect to any OpenAI-compatible server:</p>
      <p className="text-xs text-gray-500">
        Works with vLLM, text-generation-inference, llama.cpp server, or remote Ollama.
        Any server exposing <code className={codeClass}>/v1/chat/completions</code>.
      </p>
    </>
  ),
};

export function AISetupGuide({ settings, onUpdateSettings }: AISetupGuideProps) {
  const [activeTab, setActiveTab] = useState<AIProviderType>(settings.provider);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<"success" | "error" | null>(null);
  const [draft, setDraft] = useState<ProviderDraft>(() => pickProviderDraft(settings));

  const draftSettings: AISettings = { ...settings, ...draft, provider: activeTab };
  const configError = getProviderConfigError(draftSettings);

  const handleDraftChange = (updates: Partial<ProviderDraft>) => {
    setDraft((prev) => ({ ...prev, ...updates }));
    setTestResult(null);
  };

  const handleTest = async () => {
    const provider = createProvider(draftSettings);
    if (!provider) {
      setTestResult("error");
      return;
    }
    setTesting(true);
    setTestResult(null);
    const ok = await provider.ping();
    setTestResult(ok ? "success" : "error");
    setTesting(false);
  };

  const handleSave = () => {
    if (configError) return;
    onUpdateSettings({ provider: activeTab, ...draft });
  };

  return (
    <div className="px-4 py-4 overflow-y-auto h-full">
      <h3 className="text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">Set up AI Provider</h3>
      <p className="text-xs text-gray-400 mb-4">
        Connect to a local or remote LLM to power AI actions.
      </p>

      <div className="flex border-b border-gray-100 dark:border-gray-800 mb-4">
        {TABS.map((tab) => (
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

      <div className="space-y-4">
        <div className="bg-gray-50 dark:bg-gray-900 rounded-xl p-3">{INSTRUCTIONS[activeTab]}</div>
        <ProviderFields provider={activeTab} values={draft} onChange={handleDraftChange} />
        <div className="flex gap-2">
          <button
            onClick={handleTest}
            disabled={testing || !!configError}
            className="flex-1 py-2 text-sm rounded-lg border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-50 transition-colors"
          >
            {testing ? "Testing..." : "Test Connection"}
          </button>
          <button
            onClick={handleSave}
            disabled={!!configError}
            title={configError ?? undefined}
            className="flex-1 py-2 text-sm rounded-lg bg-orange-500 text-white hover:bg-orange-600 disabled:opacity-50 transition-colors"
          >
            Save & Connect
          </button>
        </div>
        <TestResultBadge result={testResult} />
      </div>
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
