import type { AISettings } from "../types/ai.ts";
import type { LLMProvider } from "./types.ts";
import { OllamaProvider } from "./ollama.ts";
import { HuggingFaceProvider } from "./huggingface.ts";
import { CustomServerProvider } from "./custom-server.ts";
import { AnthropicProvider } from "./anthropic.ts";
import { OpenAIProvider } from "./openai.ts";
import { OpenRouterProvider } from "./openrouter.ts";
import { validateServerUrl } from "./url.ts";

function hostedConfigError(apiKey: string, model: string): string | null {
  if (!apiKey.trim()) return "API key is required";
  return model.trim() ? null : "Model name is required";
}

/** Returns why `settings` cannot produce a provider, or null if they can. */
export function getProviderConfigError(settings: AISettings): string | null {
  switch (settings.provider) {
    case "ollama":
      return validateServerUrl(settings.ollamaUrl) ?? (settings.ollamaModel.trim() ? null : "Model name is required");
    case "huggingface":
      return settings.hfApiKey.trim() ? null : "API key is required";
    case "custom":
      return validateServerUrl(settings.customUrl) ?? (settings.customModel.trim() ? null : "Model name is required");
    case "anthropic":
      return hostedConfigError(settings.anthropicApiKey, settings.anthropicModel);
    case "openai":
      return hostedConfigError(settings.openaiApiKey, settings.openaiModel);
    case "openrouter":
      return hostedConfigError(settings.openrouterApiKey, settings.openrouterModel);
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
    case "anthropic":
      return new AnthropicProvider(settings.anthropicApiKey.trim(), settings.anthropicModel.trim());
    case "openai":
      return new OpenAIProvider(settings.openaiApiKey.trim(), settings.openaiModel.trim());
    case "openrouter":
      return new OpenRouterProvider(settings.openrouterApiKey.trim(), settings.openrouterModel.trim());
    default:
      return null;
  }
}
