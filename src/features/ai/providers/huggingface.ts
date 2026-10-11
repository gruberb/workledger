import type { LLMProvider, LLMMessage, LLMStreamChunk } from "./types.ts";
import { parseSSEStream } from "./stream-parser.ts";

/** Curated models available through HF Inference Providers. */
export const HF_MODELS: { id: string; label: string }[] = [
  { id: "Qwen/Qwen2.5-7B-Instruct", label: "Qwen 2.5 7B Instruct" },
  { id: "meta-llama/Llama-3.1-8B-Instruct", label: "Llama 3.1 8B Instruct" },
  { id: "meta-llama/Llama-3.2-3B-Instruct", label: "Llama 3.2 3B Instruct" },
  { id: "Qwen/Qwen3-8B", label: "Qwen 3 8B" },
  { id: "Qwen/Qwen3-4B-Instruct-2507", label: "Qwen 3 4B Instruct" },
  { id: "meta-llama/Meta-Llama-3-8B-Instruct", label: "Llama 3 8B Instruct" },
  { id: "deepseek-ai/DeepSeek-R1-Distill-Qwen-7B", label: "DeepSeek R1 Distill 7B" },
];

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
      // whoami validates the token without running (and billing) an inference
      // call. It does not prove the model is served; chat() surfaces that.
      const response = await fetch("https://huggingface.co/api/whoami-v2", {
        headers: { Authorization: `Bearer ${this.apiKey}` },
        signal: AbortSignal.timeout(10000),
      });
      return response.ok;
    } catch {
      return false;
    }
  }
}
