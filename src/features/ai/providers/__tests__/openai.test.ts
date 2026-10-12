import { describe, it, expect } from "vitest";
import { parseResponsesEvent } from "../openai.ts";

const event = (e: object) => JSON.stringify(e);

describe("parseResponsesEvent", () => {
  it("maps text deltas and url citations", () => {
    expect(parseResponsesEvent(event({ type: "response.output_text.delta", delta: "Hi" }))).toEqual({ content: "Hi", done: false });
    expect(
      parseResponsesEvent(event({ type: "response.output_text.annotation.added", annotation: { type: "url_citation", url: "https://a.dev", title: "A" } })),
    ).toEqual({ content: "", done: false, sources: [{ url: "https://a.dev", title: "A" }] });
  });

  it("ends on completion and skips unrelated or malformed events", () => {
    expect(parseResponsesEvent(event({ type: "response.completed" }))?.done).toBe(true);
    expect(parseResponsesEvent(event({ type: "response.web_search_call.searching" }))).toBeNull();
    expect(parseResponsesEvent("{oops")).toBeNull();
  });

  it("throws the API's message on failure", () => {
    expect(() => parseResponsesEvent(event({ type: "response.failed", response: { error: { message: "quota" } } }))).toThrow("OpenAI error: quota");
    expect(() => parseResponsesEvent(event({ type: "error", message: "bad model" }))).toThrow("OpenAI error: bad model");
  });
});
