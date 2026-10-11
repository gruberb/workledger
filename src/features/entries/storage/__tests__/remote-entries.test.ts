import { describe, it, expect, vi, beforeEach } from "vitest";
import { applyRemoteEntries, type RemoteEntry } from "../remote-entries.ts";

const stores = {
  entries: new Map<string, Record<string, unknown>>(),
  searchIndex: new Map<string, Record<string, unknown>>(),
};

function fakeStore(map: Map<string, Record<string, unknown>>, keyPath: string) {
  return {
    get: async (id: string) => map.get(id),
    put: async (value: Record<string, unknown>) => { map.set(value[keyPath] as string, value); },
    delete: async (id: string) => { map.delete(id); },
  };
}

vi.mock("../../../../storage/db.ts", () => ({
  getDB: async () => ({
    transaction: () => ({
      objectStore: (name: "entries" | "searchIndex") =>
        fakeStore(stores[name], name === "entries" ? "id" : "entryId"),
      done: Promise.resolve(),
    }),
  }),
}));

vi.mock("../backlinks.ts", () => ({
  updateBacklinksBatch: vi.fn(async () => undefined),
  removeFromBacklinks: vi.fn(async () => undefined),
}));

import { updateBacklinksBatch, removeFromBacklinks } from "../backlinks.ts";

function data(id: string, updatedAt: number, overrides: Record<string, unknown> = {}) {
  return {
    id,
    dayKey: "2025-06-15",
    createdAt: 1,
    updatedAt,
    blocks: [{ type: "paragraph", content: [{ type: "text", text: "Hello World" }] }],
    isArchived: false,
    tags: ["work"],
    ...overrides,
  };
}

function live(id: string, updatedAt: number, overrides: Record<string, unknown> = {}): RemoteEntry {
  return { id, isDeleted: false, updatedAt, data: data(id, updatedAt, overrides) };
}

beforeEach(() => {
  stores.entries.clear();
  stores.searchIndex.clear();
  vi.clearAllMocks();
  vi.spyOn(console, "warn").mockImplementation(() => undefined);
});

describe("applyRemoteEntries", () => {
  it("writes new entries and indexes them for search and backlinks", async () => {
    expect(await applyRemoteEntries([live("a", 10)])).toBe(1);
    expect(stores.entries.get("a")).toMatchObject({ id: "a", updatedAt: 10 });
    expect(stores.searchIndex.get("a")).toMatchObject({ plainText: "hello world", tags: ["work"], updatedAt: 10 });
    expect(updateBacklinksBatch).toHaveBeenCalledWith([{ id: "a", blocks: expect.any(Array) }]);
  });

  it("overwrites only when the remote copy is strictly newer", async () => {
    stores.entries.set("a", data("a", 10, { tags: ["local"] }));
    expect(await applyRemoteEntries([live("a", 10, { tags: ["remote"] })])).toBe(0);
    expect(stores.entries.get("a")?.tags).toEqual(["local"]);

    expect(await applyRemoteEntries([live("a", 11, { tags: ["remote"] })])).toBe(1);
    expect(stores.entries.get("a")?.tags).toEqual(["remote"]);
  });

  it("deletes the entry and all of its index rows", async () => {
    stores.entries.set("a", data("a", 10));
    stores.searchIndex.set("a", { entryId: "a" });
    expect(await applyRemoteEntries([{ id: "a", isDeleted: true, updatedAt: 1 }])).toBe(1);
    expect(stores.entries.has("a")).toBe(false);
    expect(stores.searchIndex.has("a")).toBe(false);
    expect(removeFromBacklinks).toHaveBeenCalledWith("a");
  });

  it("keeps archived entries out of the search index", async () => {
    stores.searchIndex.set("a", { entryId: "a" });
    await applyRemoteEntries([live("a", 10, { isArchived: true })]);
    expect(stores.entries.get("a")?.isArchived).toBe(true);
    expect(stores.searchIndex.has("a")).toBe(false);
  });

  it("skips invalid entries without blocking valid ones", async () => {
    const result = await applyRemoteEntries([live("bad", 10, { dayKey: "not-a-date" }), live("good", 10)]);
    expect(result).toBe(1);
    expect(stores.entries.has("bad")).toBe(false);
    expect(stores.entries.has("good")).toBe(true);
  });

  it("uses the transport id, not an id inside the payload", async () => {
    await applyRemoteEntries([{ id: "real", isDeleted: false, updatedAt: 10, data: data("spoofed", 10) }]);
    expect(stores.entries.has("real")).toBe(true);
    expect(stores.entries.has("spoofed")).toBe(false);
  });
});
