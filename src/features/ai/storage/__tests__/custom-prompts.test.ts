import { describe, it, expect } from "vitest";
import { parseCustomPrompts } from "../custom-prompts.ts";

const valid = { id: "prompt-1", name: "Design partner", instructions: "Ask", scope: "entry", webSearch: false, createdAt: 1, updatedAt: 2 };

describe("parseCustomPrompts", () => {
  it("reads stored prompts", () => {
    expect(parseCustomPrompts(JSON.stringify([valid]))).toEqual([valid]);
  });

  it("returns nothing for a missing or damaged row", () => {
    expect(parseCustomPrompts(undefined)).toEqual([]);
    expect(parseCustomPrompts("{not json")).toEqual([]);
    expect(parseCustomPrompts(JSON.stringify({ prompts: [] }))).toEqual([]);
  });

  it("drops invalid prompts and keeps the rest", () => {
    const raw = JSON.stringify([valid, { ...valid, id: "prompt-2", scope: "topic" }, { id: "prompt-3" }]);
    expect(parseCustomPrompts(raw)).toEqual([valid]);
  });
});
