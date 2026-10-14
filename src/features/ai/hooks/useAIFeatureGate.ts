import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { AISettings } from "../types/ai.ts";
import type { LLMProvider } from "../providers/types.ts";
import { createProvider, getProviderConfigError } from "../providers/provider-factory.ts";
import { pickProviderDraft } from "../utils/provider-draft.ts";

export type AIConnectionStatus = "disabled" | "unconfigured" | "checking" | "connected" | "disconnected";

interface GateOptions {
  /** Wait this long after a settings change before pinging. */
  debounceMs?: number;
}

export function useAIFeatureGate(settings: AISettings, { debounceMs = 300 }: GateOptions = {}) {
  const { enabled, provider: providerType } = settings;
  const connectionKey = JSON.stringify(pickProviderDraft(settings));

  // Keyed on connection fields only: temperature, maxTokens and webSearch changes
  // must not create a new provider and trigger another ping.
  const { provider, configError } = useMemo(() => {
    if (!enabled) return { provider: null, configError: null };
    const connection = { ...settings, provider: providerType };
    return { provider: createProvider(connection), configError: getProviderConfigError(connection) };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, providerType, connectionKey]);

  const [pingResult, setPingResult] = useState<{ provider: LLMProvider; ok: boolean } | null>(null);
  const pingResultRef = useRef(pingResult);
  pingResultRef.current = pingResult;
  const [checkKey, setCheckKey] = useState(0);
  const recheck = useCallback(() => {
    pingResultRef.current = null;
    setPingResult(null);
    setCheckKey((key) => key + 1);
  }, []);

  useEffect(() => {
    if (!provider) return;
    let cancelled = false;
    const timer = setTimeout(async () => {
      const ok = await provider.ping();
      if (cancelled) return;
      setPingResult({ provider, ok });
    }, debounceMs);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [provider, debounceMs, checkKey]);

  // Local servers may start later; check when the user returns without polling
  // an offline service while the page is idle.
  useEffect(() => {
    if (!provider) return;
    const retryIfDisconnected = () => {
      if (document.visibilityState === "visible" && pingResultRef.current?.provider === provider && !pingResultRef.current.ok) {
        recheck();
      }
    };
    window.addEventListener("focus", retryIfDisconnected);
    document.addEventListener("visibilitychange", retryIfDisconnected);
    return () => {
      window.removeEventListener("focus", retryIfDisconnected);
      document.removeEventListener("visibilitychange", retryIfDisconnected);
    };
  }, [provider, recheck]);

  let status: AIConnectionStatus;
  if (!enabled) status = "disabled";
  else if (!provider) status = "unconfigured";
  else if (pingResult?.provider !== provider) status = "checking";
  else status = pingResult.ok ? "connected" : "disconnected";

  return { provider, status, configError, available: status === "connected", recheck };
}
