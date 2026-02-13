import { useEffect, useMemo, useState } from "react";
import type { AISettings } from "../types/ai.ts";
import { createProvider } from "../ai/providers/provider-factory.ts";

export function useAIFeatureGate(settings: AISettings) {
  const [pingResult, setPingResult] = useState<{ provider: unknown; ok: boolean } | null>(null);

  const provider = useMemo(() => {
    if (!settings.enabled) return null;
    return createProvider(settings);
  }, [settings]);

  // Derive available and loading from provider + ping result
  const available = !!provider && pingResult?.provider === provider && pingResult.ok;
  const loading = !!provider && pingResult?.provider !== provider;

  useEffect(() => {
    if (!provider) return;
    provider.ping().then((ok) => {
      setPingResult({ provider, ok });
    });
  }, [provider]);

  return { available, loading };
}
