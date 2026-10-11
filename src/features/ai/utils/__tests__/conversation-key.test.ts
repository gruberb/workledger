import { describe, it, expect } from "vitest";
import { conversationKey } from "../conversation-key.ts";

describe("conversationKey", () => {
  const monday = new Date(2026, 9, 12, 9);
  const tuesday = new Date(2026, 9, 13, 9);
  const nextMonday = new Date(2026, 9, 19, 9);

  it("changes day keys every local day", () => {
    expect(conversationKey("day", { now: monday })).toBe("day-2026-10-12");
    expect(conversationKey("day", { now: tuesday })).not.toBe(conversationKey("day", { now: monday }));
  });

  it("keeps week keys stable within an ISO week and changes them across weeks", () => {
    expect(conversationKey("week", { now: monday })).toBe("week-2026-W42");
    expect(conversationKey("week", { now: tuesday })).toBe(conversationKey("week", { now: monday }));
    expect(conversationKey("week", { now: nextMonday })).toBe("week-2026-W43");
  });

  it("keys entry conversations by entry and topics by normalized query", () => {
    expect(conversationKey("entry", { entryId: "abc" })).toBe("abc");
    expect(conversationKey("topic", { query: " Auth " })).toBe(conversationKey("topic", { query: "auth" }));
  });
});
