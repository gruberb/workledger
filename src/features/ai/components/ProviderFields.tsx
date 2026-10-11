import type { AIProviderType } from "../types/ai.ts";
import type { ProviderDraft } from "../utils/provider-draft.ts";
import { HF_MODELS } from "../providers/huggingface.ts";
import { isNonLocalHttp, validateServerUrl } from "../providers/url.ts";

const inputClass = "w-full text-sm border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 outline-none focus:border-orange-300 focus:ring-1 focus:ring-orange-100 dark:focus:ring-orange-900 bg-white dark:bg-[#1a1a1a] dark:text-gray-300";
const labelClass = "text-xs text-gray-500 dark:text-gray-400 block mb-1";

interface ProviderFieldsProps {
  provider: AIProviderType;
  values: ProviderDraft;
  onChange: (updates: Partial<ProviderDraft>) => void;
  /** Models installed on the Ollama server; falls back to a text input when empty. */
  ollamaModels?: string[];
}

export function ProviderFields({ provider, values, onChange, ollamaModels = [] }: ProviderFieldsProps) {
  if (provider === "ollama") {
    return (
      <>
        <UrlField label="Server URL" value={values.ollamaUrl} placeholder="http://localhost:11434" onChange={(ollamaUrl) => onChange({ ollamaUrl })} />
        <div>
          <label className={labelClass}>Model name</label>
          {ollamaModels.length > 0 ? (
            <select value={values.ollamaModel} onChange={(e) => onChange({ ollamaModel: e.target.value })} className={inputClass}>
              {!ollamaModels.includes(values.ollamaModel) && <option value={values.ollamaModel}>{values.ollamaModel}</option>}
              {ollamaModels.map((m) => <option key={m} value={m}>{m}</option>)}
            </select>
          ) : (
            <>
              <input type="text" value={values.ollamaModel} onChange={(e) => onChange({ ollamaModel: e.target.value })} placeholder="mistral" className={inputClass} />
              <p className="text-[10px] text-gray-400 mt-1">e.g. mistral, llama3.1, phi3, qwen2.5</p>
            </>
          )}
        </div>
      </>
    );
  }

  if (provider === "huggingface") {
    return (
      <>
        <SecretField label="API Key" value={values.hfApiKey} placeholder="hf_..." onChange={(hfApiKey) => onChange({ hfApiKey })} />
        <div>
          <label className={labelClass}>Model</label>
          <select value={values.hfModel} onChange={(e) => onChange({ hfModel: e.target.value })} className={inputClass}>
            {HF_MODELS.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}
          </select>
        </div>
      </>
    );
  }

  return (
    <>
      <UrlField label="Base URL" value={values.customUrl} placeholder="https://your-server.com" onChange={(customUrl) => onChange({ customUrl })} />
      <SecretField label="API Key (optional)" value={values.customApiKey} placeholder="sk-..." onChange={(customApiKey) => onChange({ customApiKey })} />
      <div>
        <label className={labelClass}>Model name</label>
        <input type="text" value={values.customModel} onChange={(e) => onChange({ customModel: e.target.value })} placeholder="e.g. mistral, gpt-4" className={inputClass} />
      </div>
    </>
  );
}

interface FieldProps {
  label: string;
  value: string;
  placeholder: string;
  onChange: (value: string) => void;
}

function UrlField({ label, value, placeholder, onChange }: FieldProps) {
  const error = value ? validateServerUrl(value) : null;
  return (
    <div>
      <label className={labelClass}>{label}</label>
      <input type="text" value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className={inputClass} aria-invalid={!!error} />
      {error && <p className="text-[10px] text-red-500 mt-1">{error}</p>}
      {!error && isNonLocalHttp(value) && (
        <p className="text-[10px] text-amber-500 mt-1">Warning: Using unencrypted HTTP to a non-local server.</p>
      )}
    </div>
  );
}

function SecretField({ label, value, placeholder, onChange }: FieldProps) {
  return (
    <div>
      <label className={labelClass}>{label}</label>
      <input type="password" value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className={inputClass} autoComplete="off" />
      <p className="text-[10px] text-gray-400 mt-1">Stored unencrypted in this browser.</p>
    </div>
  );
}
