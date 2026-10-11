export interface LLMMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface LLMStreamChunk {
  content: string;
  done: boolean;
}

export interface LLMProvider {
  /** Send messages and stream back response chunks */
  chat(
    messages: LLMMessage[],
    options: { temperature: number; maxTokens: number; signal?: AbortSignal },
  ): AsyncGenerator<LLMStreamChunk>;

  /** Check if the provider is reachable */
  ping(): Promise<boolean>;

  /** List models the server has installed, for providers that can */
  listModels?(): Promise<string[]>;
}
