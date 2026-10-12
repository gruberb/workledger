import type Anthropic from "@anthropic-ai/sdk";
import type { BetaMessageParam, BetaRawMessageStreamEvent } from "@anthropic-ai/sdk/resources/beta/messages/messages";
import type { AISource, ChatOptions, LLMProvider, LLMMessage, LLMStreamChunk } from "./types.ts";
import { toSource } from "./stream-parser.ts";

export const ANTHROPIC_DEFAULT_MODEL = "claude-opus-5-5";

// Thinking tokens count toward max_tokens on current Claude models, so the
// settings slider (256 to 4096) alone would cut answers off mid-sentence.
const MIN_MAX_TOKENS = 16_000;
// A long web research turn can pause server-side; resume it a few times, then stop.
const MAX_PAUSE_RESUMES = 3;

/** Maps one raw stream event to a chunk: text deltas, searched pages and citations. */
export function mapAnthropicEvent(event: BetaRawMessageStreamEvent): LLMStreamChunk | null {
  if (event.type === "content_block_delta") {
    if (event.delta.type === "text_delta") return { content: event.delta.text, done: false };
    if (event.delta.type === "citations_delta" && event.delta.citation.type === "web_search_result_location") {
      const source = toSource(event.delta.citation.url, event.delta.citation.title);
      return source ? { content: "", done: false, sources: [source] } : null;
    }
    return null;
  }
  if (event.type === "content_block_start" && event.content_block.type === "web_search_tool_result") {
    const result = event.content_block.content;
    // Errors come back as a result block (HTTP 200), not as an exception.
    if (!Array.isArray(result)) return { content: `\n\n_(Web search failed: ${result.error_code})_\n\n`, done: false };
    const sources = result.map((r) => toSource(r.url, r.title)).filter((s): s is AISource => s !== null);
    return sources.length > 0 ? { content: "", done: false, sources } : null;
  }
  return null;
}

type AnthropicSDK = typeof import("@anthropic-ai/sdk").default;

function toError(Anthropic: AnthropicSDK, err: unknown): unknown {
  // useAIConversation recognises a user abort by this name.
  if (err instanceof Anthropic.APIUserAbortError) return new DOMException("Aborted", "AbortError");
  if (err instanceof Anthropic.AuthenticationError || err instanceof Anthropic.PermissionDeniedError) {
    return new Error("Anthropic: invalid API key or no access to this model");
  }
  if (err instanceof Anthropic.RateLimitError) return new Error("Anthropic: rate limited, try again shortly");
  if (err instanceof Anthropic.APIError) return new Error(`Anthropic error: ${err.status ?? ""} ${err.message}`.trim());
  return err;
}

export class AnthropicProvider implements LLMProvider {
  readonly supportsWebSearch = true;
  private readonly apiKey: string;
  private readonly model: string;
  private sdk: Promise<{ Anthropic: AnthropicSDK; client: Anthropic }> | null = null;

  constructor(apiKey: string, model: string) {
    this.apiKey = apiKey;
    this.model = model;
  }

  // The factory runs in the startup bundle (AIContext); importing the SDK on first
  // use keeps it out of every page load for users who never pick Anthropic.
  private loadSDK() {
    this.sdk ??= import("@anthropic-ai/sdk").then(({ default: Anthropic }) => ({
      Anthropic,
      // The key is the user's own, entered in this browser; there is no server to proxy through.
      client: new Anthropic({ apiKey: this.apiKey, dangerouslyAllowBrowser: true }),
    }));
    return this.sdk;
  }

  async *chat(messages: LLMMessage[], options: ChatOptions): AsyncGenerator<LLMStreamChunk> {
    const system = messages.filter((m) => m.role === "system").map((m) => m.content).join("\n\n");
    // Earlier turns are replayed as plain text, without thinking blocks.
    const history: BetaMessageParam[] = messages
      .filter((m) => m.role !== "system")
      .map((m) => ({ role: m.role as "user" | "assistant", content: m.content }));

    const { Anthropic, client } = await this.loadSDK();
    try {
      for (let resumes = 0; ; resumes++) {
        const stream = client.beta.messages.stream(
          {
            model: this.model,
            max_tokens: Math.max(options.maxTokens, MIN_MAX_TOKENS),
            ...(system && { system }),
            messages: history,
            // No temperature: current models reject sampling parameters; effort is the control.
            output_config: { effort: "medium" },
            // On a safety decline the API reruns the request on a fallback model.
            betas: ["server-side-fallback-2026-07-01"],
            fallbacks: "default",
            ...(options.webSearch && { tools: [{ type: "web_search_20260209", name: "web_search", max_uses: 5 }] }),
          },
          { signal: options.signal },
        );
        for await (const event of stream) {
          const chunk = mapAnthropicEvent(event);
          if (chunk) yield chunk;
        }
        const message = await stream.finalMessage();
        if (message.stop_reason === "refusal") throw new Error("The model declined this request.");
        if (message.stop_reason !== "pause_turn" || resumes >= MAX_PAUSE_RESUMES) break;
        // Resuming a paused turn means sending its content back unchanged.
        history.push({ role: "assistant", content: message.content as BetaMessageParam["content"] });
      }
    } catch (err) {
      throw toError(Anthropic, err);
    }
    yield { content: "", done: true };
  }

  async ping(): Promise<boolean> {
    try {
      const { client } = await this.loadSDK();
      await client.models.list({ limit: 1 }, { timeout: 5000, maxRetries: 0 });
      return true;
    } catch {
      return false;
    }
  }

  async listModels(): Promise<string[]> {
    try {
      const { client } = await this.loadSDK();
      const page = await client.models.list({ limit: 100 });
      return page.data.map((m) => m.id);
    } catch {
      return [];
    }
  }
}
