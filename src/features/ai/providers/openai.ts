import type { ChatOptions, LLMProvider, LLMMessage, LLMStreamChunk } from "./types.ts";
import { readSSEData, toSource } from "./stream-parser.ts";
import { responseError } from "./http-error.ts";

const BASE_URL = "https://api.openai.com/v1";

export const OPENAI_DEFAULT_MODEL = "gpt-5";

/**
 * Maps one Responses API stream event. Text arrives as `response.output_text.delta`,
 * web search citations as `response.output_text.annotation.added`.
 */
export function parseResponsesEvent(data: string): LLMStreamChunk | null {
  let event;
  try {
    event = JSON.parse(data);
  } catch {
    return null;
  }
  switch (event.type) {
    case "response.output_text.delta":
      return { content: event.delta ?? "", done: false };
    case "response.output_text.annotation.added": {
      const a = event.annotation;
      const source = a?.type === "url_citation" ? toSource(a.url, a.title) : null;
      return source ? { content: "", done: false, sources: [source] } : null;
    }
    case "response.completed":
    case "response.incomplete":
      return { content: "", done: true };
    case "response.failed":
      throw new Error(`OpenAI error: ${event.response?.error?.message ?? "request failed"}`);
    case "error":
      throw new Error(`OpenAI error: ${event.message ?? "request failed"}`);
    default:
      return null;
  }
}

/** Uses the Responses API: chat completions has no built-in web search tool. */
export class OpenAIProvider implements LLMProvider {
  readonly supportsWebSearch = true;

  private readonly apiKey: string;
  private readonly model: string;

  constructor(apiKey: string, model: string) {
    this.apiKey = apiKey;
    this.model = model;
  }

  async *chat(messages: LLMMessage[], options: ChatOptions): AsyncGenerator<LLMStreamChunk> {
    const response = await fetch(`${BASE_URL}/responses`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${this.apiKey}` },
      body: JSON.stringify({
        model: this.model,
        input: messages,
        // No temperature: reasoning models reject it.
        max_output_tokens: options.maxTokens,
        stream: true,
        store: false,
        ...(options.webSearch && { tools: [{ type: "web_search" }] }),
      }),
      signal: options.signal,
    });
    if (!response.ok) throw await responseError("OpenAI", response);

    const reader = response.body?.getReader();
    if (!reader) throw new Error("No response body");
    for await (const data of readSSEData(reader)) {
      const chunk = parseResponsesEvent(data);
      if (!chunk) continue;
      yield chunk;
      if (chunk.done) return;
    }
  }

  async ping(): Promise<boolean> {
    try {
      const response = await fetch(`${BASE_URL}/models`, {
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
      const response = await fetch(`${BASE_URL}/models`, {
        headers: { Authorization: `Bearer ${this.apiKey}` },
        signal: AbortSignal.timeout(10_000),
      });
      if (!response.ok) return [];
      const json = await response.json();
      return (json.data ?? []).map((m: { id: string }) => m.id).sort();
    } catch {
      return [];
    }
  }
}
