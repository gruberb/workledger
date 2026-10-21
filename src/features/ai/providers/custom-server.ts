import type { ChatOptions, LLMProvider, LLMMessage, LLMStreamChunk } from "./types.ts";
import { parseSSEStream } from "./stream-parser.ts";
import { toChatCompletionsMessages } from "./message-format.ts";
import { normalizeBaseUrl, validateServerUrl } from "./url.ts";

export class CustomServerProvider implements LLMProvider {
  readonly supportsWebSearch = false;
  private baseUrl: string;
  private model: string;
  private apiKey: string | undefined;

  constructor(baseUrl: string, model: string, apiKey?: string) {
    const error = validateServerUrl(baseUrl);
    if (error) throw new Error(error);
    this.baseUrl = normalizeBaseUrl(baseUrl);
    this.model = model;
    this.apiKey = apiKey;
  }

  async *chat(
    messages: LLMMessage[],
    options: ChatOptions,
  ): AsyncGenerator<LLMStreamChunk> {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (this.apiKey) {
      headers["Authorization"] = `Bearer ${this.apiKey}`;
    }

    const url = `${this.baseUrl}/v1/chat/completions`;
    const response = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify({
        model: this.model,
        messages: toChatCompletionsMessages(messages),
        temperature: options.temperature,
        max_tokens: options.maxTokens,
        stream: true,
      }),
      signal: options.signal,
    });

    if (!response.ok) {
      const text = await response.text().catch(() => "");
      throw new Error(`Server error: ${response.status} ${text}`);
    }

    const reader = response.body?.getReader();
    if (!reader) throw new Error("No response body");

    yield* parseSSEStream(reader);
  }

  async ping(): Promise<boolean> {
    try {
      const headers: Record<string, string> = {};
      if (this.apiKey) {
        headers["Authorization"] = `Bearer ${this.apiKey}`;
      }
      const url = `${this.baseUrl}/v1/models`;
      const response = await fetch(url, {
        headers,
        signal: AbortSignal.timeout(5000),
      });
      return response.ok;
    } catch {
      return false;
    }
  }
}
