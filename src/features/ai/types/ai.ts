export type AIProviderType = "ollama" | "huggingface" | "custom";

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
  // Generation
  temperature: number;
  maxTokens: number;
}

export const DEFAULT_AI_SETTINGS: AISettings = {
  enabled: false,
  provider: "ollama",
  ollamaUrl: "http://localhost:11434",
  ollamaModel: "mistral",
  hfApiKey: "",
  hfModel: "Qwen/Qwen2.5-7B-Instruct",
  customUrl: "",
  customApiKey: "",
  customModel: "",
  temperature: 0.7,
  maxTokens: 2048,
};

export interface AIMessage {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: number;
  frameworkStepId?: string;
  actionId?: string;
}

export interface AIConversation {
  id: string;
  entryId: string;
  frameworkId: string;
  currentStepId: string;
  messages: AIMessage[];
  createdAt: number;
  updatedAt: number;
}
