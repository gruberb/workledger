import type { AISettings } from "../types/ai.ts";

export type ProviderDraft = Pick<
  AISettings,
  "ollamaUrl" | "ollamaModel" | "hfApiKey" | "hfModel" | "customUrl" | "customApiKey" | "customModel"
>;

export function pickProviderDraft(settings: AISettings): ProviderDraft {
  const { ollamaUrl, ollamaModel, hfApiKey, hfModel, customUrl, customApiKey, customModel } = settings;
  return { ollamaUrl, ollamaModel, hfApiKey, hfModel, customUrl, customApiKey, customModel };
}

const URL_FIELDS = ["ollamaUrl", "customUrl"] as const;

/**
 * Drops URL fields that are not valid yet, so a half-typed URL is never
 * persisted. The last valid value stays in storage until the input is fixed.
 */
export function savableUpdates(
  updates: Partial<ProviderDraft>,
  isValidUrl: (url: string) => boolean,
): Partial<ProviderDraft> {
  const result = { ...updates };
  for (const field of URL_FIELDS) {
    const value = result[field];
    if (value !== undefined && !isValidUrl(value)) delete result[field];
  }
  return result;
}
