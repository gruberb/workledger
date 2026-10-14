import type { AISource } from "../providers/types.ts";

export type AIProviderType = "ollama" | "huggingface" | "custom" | "anthropic" | "openai" | "openrouter";

export interface AISettings {
  enabled: boolean;
  provider: AIProviderType;
  // Ollama
  ollamaUrl: string;
  ollamaModel: string;
  // Hugging Face
  hfApiKey: string;
  hfModel: string;
  // Custom OpenAI-compatible server
  customUrl: string;
  customApiKey: string;
  customModel: string;
  // Hosted providers, bring your own key
  anthropicApiKey: string;
  anthropicModel: string;
  openaiApiKey: string;
  openaiModel: string;
  openrouterApiKey: string;
  openrouterModel: string;
  /** Allow web search for research actions, on providers that support it. */
  webSearch: boolean;
  // Generation
  temperature: number;
  maxTokens: number;
}

export const DEFAULT_AI_SETTINGS: AISettings = {
  enabled: false,
  provider: "ollama",
  ollamaUrl: "",
  ollamaModel: "mistral",
  hfApiKey: "",
  hfModel: "Qwen/Qwen2.5-7B-Instruct",
  customUrl: "",
  customApiKey: "",
  customModel: "",
  anthropicApiKey: "",
  anthropicModel: "claude-opus-5-5",
  openaiApiKey: "",
  openaiModel: "gpt-5",
  openrouterApiKey: "",
  openrouterModel: "openrouter/auto",
  webSearch: true,
  temperature: 0.7,
  maxTokens: 2048,
};

export interface AIMessage {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: number;
  actionId?: string;
  /** Web pages the answer searched or cited. */
  sources?: AISource[];
}

export interface AIConversation {
  id: string;
  entryId: string;
  frameworkId: string;
  messages: AIMessage[];
  createdAt: number;
  updatedAt: number;
}
