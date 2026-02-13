import type { LLMProvider, LLMMessage, LLMStreamChunk } from "./types.ts";
import { parseSSEStream } from "./stream-parser.ts";

export class HuggingFaceProvider implements LLMProvider {
  private apiKey: string;
  private model: string;

  constructor(apiKey: string, model: string) {
    this.apiKey = apiKey;
    this.model = model;
  }

  async *chat(
    messages: LLMMessage[],
    options: { temperature: number; maxTokens: number; signal?: AbortSignal },
  ): AsyncGenerator<LLMStreamChunk> {
    const response = await fetch(
      `https://router.huggingface.co/v1/chat/completions`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          model: this.model,
          messages,
          temperature: options.temperature,
          max_tokens: options.maxTokens,
          stream: true,
        }),
        signal: options.signal,
      },
    );

    if (!response.ok) {
      const text = await response.text().catch(() => "");
      throw new Error(`Hugging Face error: ${response.status} ${text}`);
    }

    const reader = response.body?.getReader();
    if (!reader) throw new Error("No response body");

    yield* parseSSEStream(reader);
  }

  async ping(): Promise<boolean> {
    try {
      // Use a minimal non-streaming request to verify the token + model work
      const response = await fetch(
        `https://router.huggingface.co/v1/chat/completions`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${this.apiKey}`,
          },
          body: JSON.stringify({
            model: this.model,
            messages: [{ role: "user", content: "hi" }],
            max_tokens: 1,
            stream: false,
          }),
          signal: AbortSignal.timeout(10000),
        },
      );
      return response.ok;
    } catch {
      return false;
    }
  }

  async listModels(): Promise<string[]> {
    // Curated list of models available through HF Inference Providers
    return [
      "Qwen/Qwen2.5-7B-Instruct",
      "meta-llama/Llama-3.1-8B-Instruct",
      "meta-llama/Llama-3.2-3B-Instruct",
      "Qwen/Qwen3-8B",
      "Qwen/Qwen3-4B-Instruct-2507",
      "meta-llama/Meta-Llama-3-8B-Instruct",
      "deepseek-ai/DeepSeek-R1-Distill-Qwen-7B",
    ];
  }
}
