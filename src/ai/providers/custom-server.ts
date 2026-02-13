import type { LLMProvider, LLMMessage, LLMStreamChunk } from "./types.ts";

export class CustomServerProvider implements LLMProvider {
  private baseUrl: string;
  private model: string;
  private apiKey: string | undefined;

  constructor(baseUrl: string, model: string, apiKey?: string) {
    this.baseUrl = baseUrl;
    this.model = model;
    this.apiKey = apiKey;
  }

  async *chat(
    messages: LLMMessage[],
    options: { temperature: number; maxTokens: number; signal?: AbortSignal },
  ): AsyncGenerator<LLMStreamChunk> {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (this.apiKey) {
      headers["Authorization"] = `Bearer ${this.apiKey}`;
    }

    const url = `${this.baseUrl.replace(/\/+$/, "")}/v1/chat/completions`;
    const response = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify({
        model: this.model,
        messages,
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

    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || !trimmed.startsWith("data: ")) continue;
        const data = trimmed.slice(6);
        if (data === "[DONE]") {
          yield { content: "", done: true };
          return;
        }
        try {
          const json = JSON.parse(data);
          const content = json.choices?.[0]?.delta?.content || "";
          const finished = json.choices?.[0]?.finish_reason != null;
          yield { content, done: finished };
        } catch {
          // skip malformed chunks
        }
      }
    }
  }

  async ping(): Promise<boolean> {
    try {
      const headers: Record<string, string> = {};
      if (this.apiKey) {
        headers["Authorization"] = `Bearer ${this.apiKey}`;
      }
      const url = `${this.baseUrl.replace(/\/+$/, "")}/v1/models`;
      const response = await fetch(url, {
        headers,
        signal: AbortSignal.timeout(5000),
      });
      return response.ok;
    } catch {
      return false;
    }
  }

  async listModels(): Promise<string[]> {
    try {
      const headers: Record<string, string> = {};
      if (this.apiKey) {
        headers["Authorization"] = `Bearer ${this.apiKey}`;
      }
      const url = `${this.baseUrl.replace(/\/+$/, "")}/v1/models`;
      const response = await fetch(url, { headers });
      if (!response.ok) return [];
      const data = await response.json();
      return (data.data || []).map((m: { id: string }) => m.id);
    } catch {
      return [];
    }
  }
}
