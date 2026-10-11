import type { AISettings } from "../types/ai.ts";
import type { LLMProvider } from "./types.ts";
import { OllamaProvider } from "./ollama.ts";
import { HuggingFaceProvider } from "./huggingface.ts";
import { CustomServerProvider } from "./custom-server.ts";
import { validateServerUrl } from "./url.ts";

/** Returns why `settings` cannot produce a provider, or null if they can. */
export function getProviderConfigError(settings: AISettings): string | null {
  switch (settings.provider) {
    case "ollama":
      return validateServerUrl(settings.ollamaUrl) ?? (settings.ollamaModel.trim() ? null : "Model name is required");
    case "huggingface":
      return settings.hfApiKey.trim() ? null : "API key is required";
    case "custom":
      return validateServerUrl(settings.customUrl) ?? (settings.customModel.trim() ? null : "Model name is required");
    default:
      return "Unknown provider";
  }
}

/**
 * Never throws: settings come from user input and IndexedDB, and this runs
 * during render, so a throw here would take down the whole app.
 */
export function createProvider(settings: AISettings): LLMProvider | null {
  if (getProviderConfigError(settings)) return null;
  switch (settings.provider) {
    case "ollama":
      return new OllamaProvider(settings.ollamaUrl, settings.ollamaModel);
    case "huggingface":
      return new HuggingFaceProvider(settings.hfApiKey, settings.hfModel);
    case "custom":
      return new CustomServerProvider(settings.customUrl, settings.customModel, settings.customApiKey || undefined);
    default:
      return null;
  }
}
