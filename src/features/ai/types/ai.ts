import type { AIImage, AISource } from "../providers/types.ts";
import type { ActionScope } from "../actions/types.ts";

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
  /** Screenshots or photos the user attached. */
  images?: AIImage[];
  /** What the user typed or picked, when `content` also embeds notes as context. */
  display?: string;
}

export interface AIConversation {
  id: string;
  /** Resume key from conversationKey(), not always an entry id (e.g. "day-2026-10-21"). */
  entryId: string;
  /** Id of the action or custom prompt the thread runs with. */
  frameworkId: string;
  /** Shown in the recent threads list. Older threads have none. */
  title?: string;
  /** Note the thread was started on; "Add to note" writes here. */
  targetEntryId?: string;
  /** Topic the thread searched for, so Regenerate can run it again. */
  query?: string;
  messages: AIMessage[];
  createdAt: number;
  updatedAt: number;
}

/** A prompt the user wrote. It runs like a built-in action. */
export interface CustomPrompt {
  id: string;
  name: string;
  /** System prompt. */
  instructions: string;
  /** Notes sent along: the attached note, today's, this week's, or only the message (plus the attached note, if any). */
  scope: Extract<ActionScope, "entry" | "day" | "week" | "ask">;
  webSearch: boolean;
  createdAt: number;
  updatedAt: number;
}

/**
 * Writes AI replies into notes. Supplied by the app, which owns the editor's
 * Markdown parser, so this feature never imports the editor.
 */
export interface NoteActions {
  /** Appends the Markdown to the end of the entry. */
  addToEntry: (entryId: string, markdown: string) => Promise<void>;
  /** Creates a new entry from the Markdown and shows it. */
  createEntry: (markdown: string) => Promise<void>;
}
