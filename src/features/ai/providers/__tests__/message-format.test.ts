import { describe, it, expect } from "vitest";
import { toChatCompletionsMessages, toOllamaMessages, toResponsesInput } from "../message-format.ts";
import { toAnthropicContent } from "../anthropic.ts";
import type { LLMMessage } from "../types.ts";

const image = { mediaType: "image/png" as const, data: "iVBOR" };
const withImage: LLMMessage = { role: "user", content: "What is this?", images: [image] };
const plain: LLMMessage = { role: "assistant", content: "A chart." };

describe("message formats", () => {
  it("keep text-only messages as plain strings, without an images field", () => {
    expect(toChatCompletionsMessages([plain])).toEqual([{ role: "assistant", content: "A chart." }]);
    expect(toResponsesInput([plain])).toEqual([{ role: "assistant", content: "A chart." }]);
    expect(toOllamaMessages([plain])).toEqual([{ role: "assistant", content: "A chart." }]);
    expect(toAnthropicContent(plain)).toBe("A chart.");
  });

  it("send images as data URL parts for chat completions", () => {
    expect(toChatCompletionsMessages([withImage])[0]).toEqual({
      role: "user",
      content: [
        { type: "text", text: "What is this?" },
        { type: "image_url", image_url: { url: "data:image/png;base64,iVBOR" } },
      ],
    });
  });

  it("send images as input_image items for the Responses API", () => {
    expect(toResponsesInput([withImage])[0]).toEqual({
      role: "user",
      content: [
        { type: "input_text", text: "What is this?" },
        { type: "input_image", image_url: "data:image/png;base64,iVBOR" },
      ],
    });
  });

  it("send bare base64 strings to Ollama", () => {
    expect(toOllamaMessages([withImage])[0]).toEqual({ role: "user", content: "What is this?", images: ["iVBOR"] });
  });

  it("put Anthropic image blocks before the text", () => {
    expect(toAnthropicContent(withImage)).toEqual([
      { type: "image", source: { type: "base64", media_type: "image/png", data: "iVBOR" } },
      { type: "text", text: "What is this?" },
    ]);
  });
});
