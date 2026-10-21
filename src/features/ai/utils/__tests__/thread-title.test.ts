import { describe, it, expect } from "vitest";
import { makeThreadTitle } from "../thread-title.ts";
import { AI_ACTIONS, CHAT_ACTION, customPromptToAction } from "../../actions/actions.ts";

const byId = (id: string) => AI_ACTIONS.find((a) => a.id === id)!;
const now = new Date(2026, 9, 21, 9);

describe("makeThreadTitle", () => {
  it("uses the question for chat threads, clipped and on one line", () => {
    expect(makeThreadTitle(CHAT_ACTION, { query: "How does\n  backoff work?" })).toBe("How does backoff work?");
    const long = makeThreadTitle(CHAT_ACTION, { query: "x".repeat(100) });
    expect(long).toHaveLength(60);
    expect(long.endsWith("…")).toBe(true);
  });

  it("names entry threads after the prompt and the note", () => {
    expect(makeThreadTitle(byId("think-critique-rfd"), { entryTitle: "Scraper RFC" })).toBe("Critique this RFD: Scraper RFC");
  });

  it("dates day and week threads", () => {
    expect(makeThreadTitle(byId("summarize-day"), { now })).toBe("My Day: 2026-10-21");
    expect(makeThreadTitle(byId("summarize-week"), { now })).toBe("My Week: 2026-W43");
  });

  it("prefixes message-scoped custom prompts with their name", () => {
    const action = customPromptToAction({ id: "prompt-1", name: "Design partner", instructions: "Ask questions", scope: "ask", webSearch: false, createdAt: 0, updatedAt: 0 });
    expect(makeThreadTitle(action, { query: "Cache layer" })).toBe("Design partner: Cache layer");
  });
});
