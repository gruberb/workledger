import { describe, it, expect } from "vitest";
import { createProvider, getProviderConfigError } from "../provider-factory.ts";
import { normalizeBaseUrl, validateServerUrl } from "../url.ts";
import { DEFAULT_AI_SETTINGS, type AISettings } from "../../types/ai.ts";

const ollama = (ollamaUrl: string): AISettings => ({ ...DEFAULT_AI_SETTINGS, provider: "ollama", ollamaUrl });

describe("validateServerUrl", () => {
  it.each(["", "h", "http://", "localhost:11434", "ftp://host", "javascript:alert(1)"])(
    "rejects %j",
    (url) => expect(validateServerUrl(url)).not.toBeNull(),
  );

  it.each(["http://localhost:11434", "https://llm.example.com/", " http://127.0.0.1:8080 "])(
    "accepts %j",
    (url) => expect(validateServerUrl(url)).toBeNull(),
  );
});

describe("normalizeBaseUrl", () => {
  it("strips trailing slashes", () => {
    expect(normalizeBaseUrl("http://localhost:11434//")).toBe("http://localhost:11434");
  });
});

describe("createProvider", () => {
  it("does not select Ollama when AI is enabled without provider setup", () => {
    const settings = { ...DEFAULT_AI_SETTINGS, enabled: true };
    expect(createProvider(settings)).toBeNull();
    expect(getProviderConfigError(settings)).toBeTruthy();
  });

  it("returns null instead of throwing for partial URLs typed into settings", () => {
    for (const url of ["h", "http://", "localhost:11434"]) {
      expect(() => createProvider(ollama(url))).not.toThrow();
      expect(createProvider(ollama(url))).toBeNull();
      expect(getProviderConfigError(ollama(url))).toBeTruthy();
    }
  });

  it("creates a provider for valid settings", () => {
    expect(createProvider(ollama("http://localhost:11434/"))).not.toBeNull();
    expect(getProviderConfigError(ollama("http://localhost:11434/"))).toBeNull();
  });

  it("requires an API key for Hugging Face and a model for custom servers", () => {
    expect(createProvider({ ...DEFAULT_AI_SETTINGS, provider: "huggingface", hfApiKey: "" })).toBeNull();
    expect(createProvider({ ...DEFAULT_AI_SETTINGS, provider: "custom", customUrl: "https://x.dev", customModel: "" })).toBeNull();
  });

  it.each(["anthropic", "openai", "openrouter"] as const)("requires an API key for %s and works with the default model", (provider) => {
    expect(createProvider({ ...DEFAULT_AI_SETTINGS, provider })).toBeNull();
    expect(getProviderConfigError({ ...DEFAULT_AI_SETTINGS, provider })).toBe("API key is required");
    const configured = createProvider({ ...DEFAULT_AI_SETTINGS, provider, [`${provider}ApiKey`]: " key " });
    expect(configured?.supportsWebSearch).toBe(true);
  });
});
