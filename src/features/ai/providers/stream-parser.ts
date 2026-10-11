import type { LLMStreamChunk } from "./types.ts";

/**
 * Incremental Server-Sent Events decoder. Returns the `data` payload of each
 * completed event. Follows the SSE spec: the space after "data:" is optional,
 * multiple data lines in one event are joined with "\n", events end on a
 * blank line, and CR/LF/CRLF are all line terminators.
 */
export function createSSEDecoder() {
  let buffer = "";
  let dataLines: string[] = [];
  // A chunk ending in "\r" may be the first half of a "\r\n" pair.
  let skipLeadingLF = false;

  const processLine = (line: string, events: string[]) => {
    if (line === "") {
      if (dataLines.length > 0) events.push(dataLines.join("\n"));
      dataLines = [];
      return;
    }
    if (line.startsWith(":")) return; // comment / keep-alive
    const colon = line.indexOf(":");
    const field = colon === -1 ? line : line.slice(0, colon);
    if (field !== "data") return;
    let value = colon === -1 ? "" : line.slice(colon + 1);
    if (value.startsWith(" ")) value = value.slice(1);
    dataLines.push(value);
  };

  return {
    push(text: string): string[] {
      const events: string[] = [];
      if (skipLeadingLF && text.startsWith("\n")) text = text.slice(1);
      if (text) skipLeadingLF = text.endsWith("\r");
      buffer += text;
      const lines = buffer.split(/\r\n|\r|\n/);
      buffer = lines.pop() ?? "";
      for (const line of lines) processLine(line, events);
      return events;
    },
    /** Dispatches whatever is left when the stream ends without a final blank line. */
    flush(): string[] {
      const events: string[] = [];
      if (buffer) processLine(buffer, events);
      buffer = "";
      processLine("", events);
      return events;
    },
  };
}

/** Maps one OpenAI-compatible chat completion SSE payload to a chunk. */
export function parseChatCompletionEvent(data: string): LLMStreamChunk | null {
  if (data === "[DONE]") return { content: "", done: true };
  try {
    const json = JSON.parse(data);
    const content = json.choices?.[0]?.delta?.content || "";
    const finished = json.choices?.[0]?.finish_reason != null;
    return { content, done: finished };
  } catch {
    return null; // skip malformed chunks
  }
}

export async function* parseSSEStream(
  reader: ReadableStreamDefaultReader<Uint8Array>,
): AsyncGenerator<LLMStreamChunk> {
  const textDecoder = new TextDecoder();
  const sse = createSSEDecoder();

  while (true) {
    const { done, value } = await reader.read();
    const events = done
      ? [...sse.push(textDecoder.decode()), ...sse.flush()]
      : sse.push(textDecoder.decode(value, { stream: true }));

    for (const data of events) {
      const chunk = parseChatCompletionEvent(data);
      if (!chunk) continue;
      yield chunk;
      if (data === "[DONE]") return;
    }
    if (done) return;
  }
}
