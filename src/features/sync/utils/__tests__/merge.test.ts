import { describe, it, expect, vi, beforeEach } from "vitest";
import { mergeRemoteEntries } from "../merge.ts";

// --- Mocks ---

const mockDb = {
  put: vi.fn(),
  delete: vi.fn(),
};

vi.mock("../../../../storage/db.ts", () => ({
  getDB: vi.fn(() => Promise.resolve(mockDb)),
}));

const localEntries = new Map<string, Record<string, unknown>>();

vi.mock("../../../entries/index.ts", () => ({
  getEntry: vi.fn((id: string) => Promise.resolve(localEntries.get(id) ?? null)),
  deleteSearchIndex: vi.fn(() => Promise.resolve()),
  updateSearchIndex: vi.fn(() => Promise.resolve()),
  validateEntry: vi.fn((entry: Record<string, unknown>) => entry),
}));

// Re-import mocks for assertion access
import { getEntry, deleteSearchIndex, updateSearchIndex, validateEntry } from "../../../entries/index.ts";

function makeRemoteEntry(overrides: Record<string, unknown> = {}) {
  return {
    id: "entry-1",
    dayKey: "2025-06-15",
    createdAt: 1000,
    updatedAt: 2000,
    blocks: [{ type: "paragraph", content: [{ type: "text", text: "Hello" }] }],
    isArchived: false,
    isDeleted: false,
    tags: ["work"],
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  localEntries.clear();
});

// --- Last-write-wins tests ---

describe("mergeRemoteEntries — last-write-wins", () => {
  it("writes entry when no local version exists", async () => {
    const remote = makeRemoteEntry();
    const count = await mergeRemoteEntries([remote]);

    expect(count).toBe(1);
    expect(mockDb.put).toHaveBeenCalledWith("entries", expect.objectContaining({ id: "entry-1" }));
  });

  it("overwrites local when remote.updatedAt > local.updatedAt", async () => {
    localEntries.set("entry-1", { id: "entry-1", updatedAt: 1000 });
    const remote = makeRemoteEntry({ updatedAt: 2000 });

    const count = await mergeRemoteEntries([remote]);

    expect(count).toBe(1);
    expect(mockDb.put).toHaveBeenCalled();
  });

  it("keeps local when remote.updatedAt === local.updatedAt (ties keep local)", async () => {
    localEntries.set("entry-1", { id: "entry-1", updatedAt: 2000 });
    const remote = makeRemoteEntry({ updatedAt: 2000 });

    const count = await mergeRemoteEntries([remote]);

    expect(count).toBe(0);
    expect(mockDb.put).not.toHaveBeenCalled();
  });

  it("keeps local when remote.updatedAt < local.updatedAt", async () => {
    localEntries.set("entry-1", { id: "entry-1", updatedAt: 3000 });
    const remote = makeRemoteEntry({ updatedAt: 2000 });

    const count = await mergeRemoteEntries([remote]);

    expect(count).toBe(0);
    expect(mockDb.put).not.toHaveBeenCalled();
  });
});

// --- Deletion handling ---

describe("mergeRemoteEntries — deletion", () => {
  it("deletes local entry when remote is deleted", async () => {
    localEntries.set("entry-1", { id: "entry-1", updatedAt: 5000 });
    const remote = makeRemoteEntry({ isDeleted: true, updatedAt: 1000 });

    const count = await mergeRemoteEntries([remote]);

    expect(count).toBe(1);
    expect(mockDb.delete).toHaveBeenCalledWith("entries", "entry-1");
    expect(deleteSearchIndex).toHaveBeenCalledWith("entry-1");
  });

  it("deletion wins regardless of timestamps (no timestamp guard)", async () => {
    localEntries.set("entry-1", { id: "entry-1", updatedAt: 99999 });
    const remote = makeRemoteEntry({ isDeleted: true, updatedAt: 1 });

    const count = await mergeRemoteEntries([remote]);

    expect(count).toBe(1);
    expect(mockDb.delete).toHaveBeenCalledWith("entries", "entry-1");
  });

  it("skips deletion when no local entry exists", async () => {
    const remote = makeRemoteEntry({ isDeleted: true });

    const count = await mergeRemoteEntries([remote]);

    expect(count).toBe(0);
    expect(mockDb.delete).not.toHaveBeenCalled();
  });
});

// --- Validation ---

describe("mergeRemoteEntries — validation", () => {
  it("skips entries that fail validation", async () => {
    vi.mocked(validateEntry).mockImplementationOnce(() => {
      throw new Error("Zod validation failed");
    });

    const remote = makeRemoteEntry();
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    const count = await mergeRemoteEntries([remote]);

    expect(count).toBe(0);
    expect(mockDb.put).not.toHaveBeenCalled();
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining("failed validation"),
      expect.any(String),
    );

    warnSpy.mockRestore();
  });

  it("continues processing after a validation failure", async () => {
    vi.mocked(validateEntry)
      .mockImplementationOnce(() => { throw new Error("bad"); })
      .mockImplementationOnce((entry: unknown) => entry);

    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const entries = [
      makeRemoteEntry({ id: "bad-entry" }),
      makeRemoteEntry({ id: "good-entry" }),
    ];

    const count = await mergeRemoteEntries(entries);

    expect(count).toBe(1);
    expect(mockDb.put).toHaveBeenCalledTimes(1);
    expect(mockDb.put).toHaveBeenCalledWith("entries", expect.objectContaining({ id: "good-entry" }));

    warnSpy.mockRestore();
  });
});

// --- Search index update ---

describe("mergeRemoteEntries — search index", () => {
  it("updates search index after writing a merged entry with blocks", async () => {
    const remote = makeRemoteEntry({
      blocks: [{ type: "paragraph", content: [{ type: "text", text: "Searchable content" }] }],
      tags: ["test"],
    });

    await mergeRemoteEntries([remote]);

    expect(updateSearchIndex).toHaveBeenCalledWith(
      "entry-1",
      "2025-06-15",
      remote.blocks,
      ["test"],
    );
  });

  it("does not update search index for entries with empty blocks", async () => {
    const remote = makeRemoteEntry({ blocks: [] });

    await mergeRemoteEntries([remote]);

    expect(updateSearchIndex).not.toHaveBeenCalled();
  });

  it("does not update search index when local is kept (no overwrite)", async () => {
    localEntries.set("entry-1", { id: "entry-1", updatedAt: 9999 });
    const remote = makeRemoteEntry({ updatedAt: 1000 });

    await mergeRemoteEntries([remote]);

    expect(updateSearchIndex).not.toHaveBeenCalled();
  });
});

// --- Batch processing ---

describe("mergeRemoteEntries — batch", () => {
  it("processes multiple entries correctly", async () => {
    localEntries.set("entry-2", { id: "entry-2", updatedAt: 5000 });

    const entries = [
      makeRemoteEntry({ id: "entry-1", updatedAt: 1000 }),  // new → write
      makeRemoteEntry({ id: "entry-2", updatedAt: 3000 }),  // older → skip
      makeRemoteEntry({ id: "entry-3", updatedAt: 2000, isDeleted: true }),  // delete non-existent → skip
    ];

    const count = await mergeRemoteEntries(entries);

    expect(count).toBe(1);
    expect(getEntry).toHaveBeenCalledTimes(3);
  });

  it("handles empty array", async () => {
    const count = await mergeRemoteEntries([]);
    expect(count).toBe(0);
  });
});
