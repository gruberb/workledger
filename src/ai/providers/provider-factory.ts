import type { AISettings } from "../../types/ai.ts";
import type { LLMProvider } from "./types.ts";
import { OllamaProvider } from "./ollama.ts";
import { HuggingFaceProvider } from "./huggingface.ts";
import { CustomServerProvider } from "./custom-server.ts";

export function createProvider(settings: AISettings): LLMProvider | null {
  switch (settings.provider) {
    case "ollama":
      if (!settings.ollamaUrl) return null;
      return new OllamaProvider(settings.ollamaUrl, settings.ollamaModel);

    case "huggingface":
      if (!settings.hfApiKey) return null;
      return new HuggingFaceProvider(settings.hfApiKey, settings.hfModel);

    case "custom":
      if (!settings.customUrl || !settings.customModel) return null;
      return new CustomServerProvider(
        settings.customUrl,
        settings.customModel,
        settings.customApiKey || undefined,
      );

    default:
      return null;
  }
}
