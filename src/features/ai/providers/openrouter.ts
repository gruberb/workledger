import type { ChatOptions, LLMProvider, LLMMessage, LLMStreamChunk } from "./types.ts";
import { parseSSEStream } from "./stream-parser.ts";
import { toChatCompletionsMessages } from "./message-format.ts";
import { responseError } from "./http-error.ts";

const BASE_URL = "https://openrouter.ai/api/v1";

/** OpenRouter's router picks a model per request, so a key alone is a working setup. */
export const OPENROUTER_DEFAULT_MODEL = "openrouter/auto";

export class OpenRouterProvider implements LLMProvider {
  readonly supportsWebSearch = true;

  private readonly apiKey: string;
  private readonly model: string;

  constructor(apiKey: string, model: string) {
    this.apiKey = apiKey;
    this.model = model;
  }

  async *chat(messages: LLMMessage[], options: ChatOptions): AsyncGenerator<LLMStreamChunk> {
    const response = await fetch(`${BASE_URL}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.apiKey}`,
        "X-Title": "WorkLedger",
      },
      body: JSON.stringify({
        model: this.model,
        messages: toChatCompletionsMessages(messages),
        temperature: options.temperature,
        max_tokens: options.maxTokens,
        stream: true,
        // The web plugin returns url_citation annotations, which parseSSEStream turns into sources.
        ...(options.webSearch && { plugins: [{ id: "web" }] }),
      }),
      signal: options.signal,
    });
    if (!response.ok) throw await responseError("OpenRouter", response);

    const reader = response.body?.getReader();
    if (!reader) throw new Error("No response body");
    yield* parseSSEStream(reader);
  }

  async ping(): Promise<boolean> {
    try {
      // /key validates the key without running (and billing) a completion.
      const response = await fetch(`${BASE_URL}/key`, {
        headers: { Authorization: `Bearer ${this.apiKey}` },
        signal: AbortSignal.timeout(5000),
      });
      return response.ok;
    } catch {
      return false;
    }
  }

  async listModels(): Promise<string[]> {
    try {
      const response = await fetch(`${BASE_URL}/models`, { signal: AbortSignal.timeout(10_000) });
      if (!response.ok) return [];
      const json = await response.json();
      return (json.data ?? []).map((m: { id: string }) => m.id).sort();
    } catch {
      return [];
    }
  }
}
