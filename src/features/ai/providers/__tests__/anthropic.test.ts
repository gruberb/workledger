import { describe, it, expect, vi } from "vitest";
import Anthropic from "@anthropic-ai/sdk";
import type { BetaRawMessageStreamEvent } from "@anthropic-ai/sdk/resources/beta/messages/messages";
import { AnthropicProvider, mapAnthropicEvent } from "../anthropic.ts";
import type { LLMStreamChunk } from "../types.ts";

const ev = (e: object) => e as BetaRawMessageStreamEvent;

describe("mapAnthropicEvent", () => {
  it("maps text deltas and web search citations", () => {
    expect(mapAnthropicEvent(ev({ type: "content_block_delta", index: 0, delta: { type: "text_delta", text: "Hi" } }))).toEqual({ content: "Hi", done: false });
    const citation = { type: "web_search_result_location", url: "https://a.dev", title: "A", cited_text: "", encrypted_index: "" };
    expect(mapAnthropicEvent(ev({ type: "content_block_delta", index: 0, delta: { type: "citations_delta", citation } }))?.sources).toEqual([
      { url: "https://a.dev", title: "A" },
    ]);
  });

  it("collects searched pages and reports search errors without throwing", () => {
    const results = [{ type: "web_search_result", url: "https://b.dev", title: "B", encrypted_content: "", page_age: null }];
    const start = (content: unknown) =>
      ev({ type: "content_block_start", index: 1, content_block: { type: "web_search_tool_result", tool_use_id: "t", content } });
    expect(mapAnthropicEvent(start(results))?.sources).toEqual([{ url: "https://b.dev", title: "B" }]);
    expect(mapAnthropicEvent(start({ type: "web_search_tool_result_error", error_code: "max_uses_exceeded" }))?.content).toContain("max_uses_exceeded");
  });
});

/** A fake SDK stream: yields `events`, then resolves `finalMessage` with `stop_reason`. */
function fakeStream(events: object[], stop_reason: string, content: object[] = []) {
  return {
    async *[Symbol.asyncIterator]() {
      yield* events;
    },
    finalMessage: async () => ({ stop_reason, content }),
  };
}

function providerWith(stream: ReturnType<typeof vi.fn>) {
  const provider = new AnthropicProvider("key", "claude-opus-5-5");
  // Swap the lazily loaded client for a fake; error classes stay the real SDK's.
  (provider as unknown as { sdk: unknown }).sdk = Promise.resolve({ Anthropic, client: { beta: { messages: { stream } } } });
  return provider;
}

async function collect(gen: AsyncGenerator<LLMStreamChunk>) {
  const chunks: LLMStreamChunk[] = [];
  for await (const chunk of gen) chunks.push(chunk);
  return chunks;
}

const text = (t: string) => ({ type: "content_block_delta", index: 0, delta: { type: "text_delta", text: t } });
const opts = { temperature: 0.7, maxTokens: 2048 };

describe("AnthropicProvider.chat", () => {
  it("sends the web search tool only when asked, never temperature, and a max_tokens floor", async () => {
    const stream = vi.fn(() => fakeStream([text("a")], "end_turn"));
    await collect(providerWith(stream).chat([{ role: "system", content: "S" }, { role: "user", content: "Q" }], { ...opts, webSearch: true }));
    const [params] = stream.mock.calls[0] as unknown as [Record<string, unknown>];
    expect(params.system).toBe("S");
    expect(params.messages).toEqual([{ role: "user", content: "Q" }]);
    expect(params.tools).toEqual([{ type: "web_search_20260209", name: "web_search", max_uses: 5 }]);
    expect(params).not.toHaveProperty("temperature");
    expect(params.max_tokens).toBe(16_000);

    await collect(providerWith(stream).chat([{ role: "user", content: "Q" }], opts));
    expect(stream.mock.calls[1][0]).not.toHaveProperty("tools");
  });

  it("resumes a paused turn by sending its content back", async () => {
    const paused = [{ type: "server_tool_use", id: "s", name: "web_search", input: {} }];
    const stream = vi
      .fn()
      .mockReturnValueOnce(fakeStream([text("part 1 ")], "pause_turn", paused))
      .mockReturnValueOnce(fakeStream([text("part 2")], "end_turn"));
    const chunks = await collect(providerWith(stream).chat([{ role: "user", content: "Q" }], opts));
    expect(chunks.map((c) => c.content).join("")).toBe("part 1 part 2");
    const [second] = stream.mock.calls[1] as unknown as [{ messages: unknown[] }];
    expect(second.messages).toEqual([{ role: "user", content: "Q" }, { role: "assistant", content: paused }]);
  });

  it("fails on refusal and maps aborts and auth errors", async () => {
    await expect(collect(providerWith(vi.fn(() => fakeStream([], "refusal"))).chat([{ role: "user", content: "Q" }], opts))).rejects.toThrow("declined");

    const abort = vi.fn(() => {
      throw new Anthropic.APIUserAbortError();
    });
    await expect(collect(providerWith(abort).chat([{ role: "user", content: "Q" }], opts))).rejects.toMatchObject({ name: "AbortError" });

    const auth = vi.fn(() => {
      throw new Anthropic.AuthenticationError(401, undefined, "bad key", new Headers());
    });
    await expect(collect(providerWith(auth).chat([{ role: "user", content: "Q" }], opts))).rejects.toThrow("invalid API key");
  });
});
