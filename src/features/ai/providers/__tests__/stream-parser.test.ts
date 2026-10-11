import { describe, it, expect } from "vitest";
import { createSSEDecoder, parseSSEStream } from "../stream-parser.ts";

function decodeAll(chunks: string[]): string[] {
  const d = createSSEDecoder();
  return [...chunks.flatMap((c) => d.push(c)), ...d.flush()];
}

function readerFrom(chunks: string[]): ReadableStreamDefaultReader<Uint8Array> {
  const enc = new TextEncoder();
  return new ReadableStream<Uint8Array>({
    start(controller) {
      for (const c of chunks) controller.enqueue(enc.encode(c));
      controller.close();
    },
  }).getReader();
}

describe("createSSEDecoder", () => {
  it("accepts data fields with and without the optional space", () => {
    expect(decodeAll(["data: a\n\ndata:b\n\n"])).toEqual(["a", "b"]);
  });

  it("joins multi-line data within one event", () => {
    expect(decodeAll(["data: one\ndata: two\n\n"])).toEqual(["one\ntwo"]);
  });

  it("handles events split across chunks, including a split CRLF", () => {
    expect(decodeAll(["da", "ta: x\r", "\n\r\n", "data: y\n", "\n"])).toEqual(["x", "y"]);
  });

  it("ignores comments and other fields", () => {
    expect(decodeAll([": keep-alive\nevent: msg\nid: 1\ndata: z\n\n"])).toEqual(["z"]);
  });

  it("flushes a final event that has no trailing blank line", () => {
    expect(decodeAll(["data: first\n\ndata: last"])).toEqual(["first", "last"]);
  });
});

describe("parseSSEStream", () => {
  it("yields content deltas and stops at [DONE]", async () => {
    const delta = (c: string) => `data: ${JSON.stringify({ choices: [{ delta: { content: c } }] })}\n\n`;
    const reader = readerFrom([delta("Hel"), delta("lo"), "data: [DONE]\n\n", delta("ignored")]);
    let text = "";
    let sawDone = false;
    for await (const chunk of parseSSEStream(reader)) {
      text += chunk.content;
      if (chunk.done) sawDone = true;
    }
    expect(text).toBe("Hello");
    expect(sawDone).toBe(true);
  });

  it("does not drop the last event when the stream ends mid-event", async () => {
    const last = `data: ${JSON.stringify({ choices: [{ delta: { content: "tail" } }] })}`;
    let text = "";
    for await (const chunk of parseSSEStream(readerFrom([last]))) text += chunk.content;
    expect(text).toBe("tail");
  });
});
