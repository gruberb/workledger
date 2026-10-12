import { describe, it, expect, vi } from "vitest";

// The entries public API pulls in React components; only SIGNIFIER_CONFIG is needed here.
vi.mock("../../../entries/index.ts", () => ({
  SIGNIFIER_CONFIG: { decision: {}, question: {}, idea: {}, milestone: {} },
}));

import { normalizeSavedFilters, savedFilterMatches } from "../saved-filters.ts";

describe("normalizeSavedFilters", () => {
  it("loads filters saved before signifiers existed, without their text query", () => {
    const legacy = [{ id: "1", name: "Bugs", tags: ["bug"], textQuery: "crash" }];
    expect(normalizeSavedFilters(legacy)).toEqual([
      { id: "1", name: "Bugs", tags: ["bug"], signifiers: [] },
    ]);
  });

  it("drops text-only filters, which would now match everything", () => {
    expect(normalizeSavedFilters([{ id: "1", name: "Crash", tags: [], textQuery: "crash", signifiers: [] }])).toEqual([]);
  });

  it("drops unknown signifiers and malformed entries", () => {
    const raw = [{ id: "1", name: "x", tags: [], signifiers: ["idea", "note", 3] }, null, { name: "no id" }];
    expect(normalizeSavedFilters(raw)).toEqual([
      { id: "1", name: "x", tags: [], signifiers: ["idea"] },
    ]);
  });

  it("returns [] for non-arrays", () => {
    expect(normalizeSavedFilters({})).toEqual([]);
  });
});

describe("savedFilterMatches", () => {
  const filter = { id: "1", name: "x", tags: ["a", "b"], signifiers: ["idea" as const] };

  it("ignores order within tags and signifiers", () => {
    expect(savedFilterMatches(filter, { tags: ["b", "a"], signifiers: ["idea"] })).toBe(true);
  });

  it("treats signifiers as part of the filter", () => {
    expect(savedFilterMatches(filter, { tags: ["a", "b"], signifiers: [] })).toBe(false);
    expect(savedFilterMatches({ ...filter, tags: [] }, { tags: [], signifiers: ["idea"] })).toBe(true);
  });
});
