import { describe, it, expect, vi } from "vitest";

// The entries public API pulls in React components; only SIGNIFIER_CONFIG is needed here.
vi.mock("../../../entries/index.ts", () => ({
  SIGNIFIER_CONFIG: { decision: {}, question: {}, idea: {}, milestone: {} },
}));

import { normalizeSavedFilters, savedFilterMatches } from "../saved-filters.ts";

describe("normalizeSavedFilters", () => {
  it("loads filters saved before signifiers existed", () => {
    const legacy = [{ id: "1", name: "Bugs", tags: ["bug"], textQuery: "crash" }];
    expect(normalizeSavedFilters(legacy)).toEqual([
      { id: "1", name: "Bugs", tags: ["bug"], textQuery: "crash", signifiers: [] },
    ]);
  });

  it("drops unknown signifiers and malformed entries", () => {
    const raw = [{ id: "1", name: "x", tags: [], textQuery: "", signifiers: ["idea", "note", 3] }, null, { name: "no id" }];
    expect(normalizeSavedFilters(raw)).toEqual([
      { id: "1", name: "x", tags: [], textQuery: "", signifiers: ["idea"] },
    ]);
  });

  it("returns [] for non-arrays", () => {
    expect(normalizeSavedFilters({})).toEqual([]);
  });
});

describe("savedFilterMatches", () => {
  const filter = { id: "1", name: "x", tags: ["a", "b"], textQuery: "q", signifiers: ["idea" as const] };

  it("ignores order within tags and signifiers", () => {
    expect(savedFilterMatches(filter, { tags: ["b", "a"], textQuery: "q", signifiers: ["idea"] })).toBe(true);
  });

  it("treats signifiers as part of the filter", () => {
    expect(savedFilterMatches(filter, { tags: ["a", "b"], textQuery: "q", signifiers: [] })).toBe(false);
    expect(
      savedFilterMatches({ ...filter, tags: [], textQuery: "" }, { tags: [], textQuery: "", signifiers: ["idea"] }),
    ).toBe(true);
  });
});
