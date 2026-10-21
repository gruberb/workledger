import type { LLMMessage } from "./types.ts";
import { imageDataUrl as dataUrl } from "../utils/images.ts";

/** OpenAI-compatible chat completions (OpenRouter, custom servers, Hugging Face). */
export function toChatCompletionsMessages(messages: LLMMessage[]) {
  return messages.map(({ role, content, images }) => images?.length
    ? {
        role,
        content: [
          { type: "text", text: content },
          ...images.map((image) => ({ type: "image_url", image_url: { url: dataUrl(image) } })),
        ],
      }
    : { role, content });
}

/** OpenAI Responses API input items. */
export function toResponsesInput(messages: LLMMessage[]) {
  return messages.map(({ role, content, images }) => images?.length
    ? {
        role,
        content: [
          { type: "input_text", text: content },
          ...images.map((image) => ({ type: "input_image", image_url: dataUrl(image) })),
        ],
      }
    : { role, content });
}

/** Ollama takes bare base64 strings next to the text; only vision models use them. */
export function toOllamaMessages(messages: LLMMessage[]) {
  return messages.map(({ role, content, images }) => images?.length
    ? { role, content, images: images.map((image) => image.data) }
    : { role, content });
}
