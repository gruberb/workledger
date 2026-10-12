import type { AISettings } from "../types/ai.ts";

/** Connection fields: changing one creates a new provider and re-pings it. */
const DRAFT_FIELDS = [
  "ollamaUrl", "ollamaModel",
  "hfApiKey", "hfModel",
  "customUrl", "customApiKey", "customModel",
  "anthropicApiKey", "anthropicModel",
  "openaiApiKey", "openaiModel",
  "openrouterApiKey", "openrouterModel",
] as const satisfies readonly (keyof AISettings)[];

export type ProviderDraft = Pick<AISettings, (typeof DRAFT_FIELDS)[number]>;

export function pickProviderDraft(settings: AISettings): ProviderDraft {
  const draft = {} as ProviderDraft;
  for (const field of DRAFT_FIELDS) draft[field] = settings[field];
  return draft;
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
