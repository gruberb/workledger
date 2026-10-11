import { useEffect, useMemo, useState } from "react";
import type { AISettings } from "../types/ai.ts";
import type { LLMProvider } from "../providers/types.ts";
import { createProvider, getProviderConfigError } from "../providers/provider-factory.ts";

export type AIConnectionStatus = "disabled" | "unconfigured" | "checking" | "connected" | "disconnected";

interface GateOptions {
  /** Wait this long after a settings change before pinging. */
  debounceMs?: number;
  /** Re-ping this often while the provider is unreachable (e.g. Ollama not started yet). */
  retryMs?: number;
}

export function useAIFeatureGate(settings: AISettings, { debounceMs = 300, retryMs = 30_000 }: GateOptions = {}) {
  const { enabled, provider: providerType, ollamaUrl, ollamaModel, hfApiKey, hfModel, customUrl, customApiKey, customModel } = settings;

  // Keyed on connection fields only: temperature and maxTokens changes must
  // not create a new provider and trigger another ping.
  const { provider, configError } = useMemo(() => {
    if (!enabled) return { provider: null, configError: null };
    const connection = { ...settings, provider: providerType, ollamaUrl, ollamaModel, hfApiKey, hfModel, customUrl, customApiKey, customModel };
    return { provider: createProvider(connection), configError: getProviderConfigError(connection) };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, providerType, ollamaUrl, ollamaModel, hfApiKey, hfModel, customUrl, customApiKey, customModel]);

  const [pingResult, setPingResult] = useState<{ provider: LLMProvider; ok: boolean } | null>(null);

  useEffect(() => {
    if (!provider) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;
    const check = async () => {
      const ok = await provider.ping();
      if (cancelled) return;
      setPingResult({ provider, ok });
      if (!ok) timer = setTimeout(check, retryMs);
    };
    timer = setTimeout(check, debounceMs);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [provider, debounceMs, retryMs]);

  let status: AIConnectionStatus;
  if (!enabled) status = "disabled";
  else if (!provider) status = "unconfigured";
  else if (pingResult?.provider !== provider) status = "checking";
  else status = pingResult.ok ? "connected" : "disconnected";

  return { provider, status, configError, available: status === "connected" };
}
