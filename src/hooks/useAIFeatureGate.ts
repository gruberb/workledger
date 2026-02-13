import { useState, useEffect } from "react";
import type { AISettings } from "../types/ai.ts";
import { createProvider } from "../ai/providers/provider-factory.ts";

export function useAIFeatureGate(settings: AISettings) {
  const [available, setAvailable] = useState(false);
  const [checking, setChecking] = useState(false);

  useEffect(() => {
    if (!settings.enabled) {
      Promise.resolve().then(() => setAvailable(false));
      return;
    }

    const provider = createProvider(settings);
    if (!provider) {
      Promise.resolve().then(() => setAvailable(false));
      return;
    }

    Promise.resolve().then(() => setChecking(true));
    provider.ping().then((ok) => {
      setAvailable(ok);
      setChecking(false);
    });
  }, [settings]);

  return { available, checking };
}
