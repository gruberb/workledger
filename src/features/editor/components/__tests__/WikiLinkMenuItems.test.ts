import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const { searchEntries, getRecentSearchEntries, getEntry } = vi.hoisted(() => ({
  searchEntries: vi.fn(),
  getRecentSearchEntries: vi.fn(),
  getEntry: vi.fn(),
}));

vi.mock("../../../entries/index.ts", () => ({
  searchEntries,
  getRecentSearchEntries,
  getEntry,
  extractTitle: () => "from entry",
}));

import { getWikiLinkMenuItems } from "../WikiLinkMenuItems.ts";

const row = (entryId: string, extra = {}) => ({
  entryId, dayKey: "2026-01-02", plainText: "", updatedAt: 1, tags: [], ...extra,
});

beforeEach(() => {
  vi.useFakeTimers();
  vi.clearAllMocks();
});
afterEach(() => vi.useRealTimers());

describe("getWikiLinkMenuItems", () => {
  it("builds items from the search row without reading the entry", async () => {
    getRecentSearchEntries.mockResolvedValue([row("a", { title: "Title A", createdAt: 0 }), row("self", { title: "Me", createdAt: 0 })]);
    const items = await getWikiLinkMenuItems("", "self");
    expect(items.map((i) => [i.entryId, i.displayText])).toEqual([["a", "Title A"]]);
    expect(getEntry).not.toHaveBeenCalled();
  });

  it("falls back to the entry for rows indexed before titles were stored", async () => {
    getRecentSearchEntries.mockResolvedValue([row("old"), row("archived")]);
    getEntry.mockImplementation(async (id: string) =>
      id === "old" ? { id, createdAt: 0, isArchived: false } : { id, createdAt: 0, isArchived: true });
    const items = await getWikiLinkMenuItems("");
    expect(items.map((i) => [i.entryId, i.displayText])).toEqual([["old", "from entry"]]);
  });

  it("searches once for a burst of keystrokes, using the last query", async () => {
    searchEntries.mockResolvedValue([row("a", { title: "A", createdAt: 0 })]);
    const calls = ["t", "te", "tes"].map((q) => getWikiLinkMenuItems(q, undefined, 30, 150));
    await vi.advanceTimersByTimeAsync(150);
    const [first, second, last] = await Promise.all(calls);
    expect(searchEntries).toHaveBeenCalledTimes(1);
    expect(searchEntries).toHaveBeenCalledWith("tes");
    expect(first).toEqual([]);
    expect(second).toEqual([]);
    expect(last).toHaveLength(1);
  });

  it("answers an empty query immediately", async () => {
    getRecentSearchEntries.mockResolvedValue([]);
    await expect(getWikiLinkMenuItems("", undefined, 30, 150)).resolves.toEqual([]);
  });
});
