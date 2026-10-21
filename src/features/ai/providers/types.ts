/** An image attached to a user message, base64 without the `data:` prefix. */
export interface AIImage {
  mediaType: "image/png" | "image/jpeg" | "image/webp" | "image/gif";
  data: string;
}

export interface LLMMessage {
  role: "system" | "user" | "assistant";
  content: string;
  images?: AIImage[];
}

/** A web page the model cited or searched. */
export interface AISource {
  url: string;
  title?: string;
}

export interface LLMStreamChunk {
  content: string;
  done: boolean;
  sources?: AISource[];
}

export interface ChatOptions {
  temperature: number;
  maxTokens: number;
  signal?: AbortSignal;
  /** Let the model search the web. Ignored by providers without `supportsWebSearch`. */
  webSearch?: boolean;
}

export interface LLMProvider {
  /** Whether `chat` honors `webSearch`. */
  readonly supportsWebSearch: boolean;

  /** Send messages and stream back response chunks */
  chat(messages: LLMMessage[], options: ChatOptions): AsyncGenerator<LLMStreamChunk>;

  /** Check if the provider is reachable */
  ping(): Promise<boolean>;

  /** List models the server has installed, for providers that can */
  listModels?(): Promise<string[]>;
}
