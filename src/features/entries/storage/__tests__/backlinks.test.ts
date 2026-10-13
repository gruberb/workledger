import { describe, it, expect, vi, beforeEach } from "vitest";

// Minimal in-memory stand-in for the settings store. vi.hoisted because
// vi.mock factories run before module-level code.
const { settings, writes, clearHooks, fakeDb } = vi.hoisted(() => {
  const settings = new Map<string, { key: string; value: string }>();
  const writes = { count: 0 };
  const store = {
    get: async (key: string) => settings.get(key),
    put: async (row: { key: string; value: string }) => { writes.count++; settings.set(row.key, row); },
  };
  return {
    settings,
    writes,
    clearHooks: [] as (() => void)[],
    fakeDb: {
      get: vi.fn(async (_store: string, key: string) => settings.get(key)),
      transaction: () => ({ store, done: Promise.resolve() }),
    },
  };
});

vi.mock("../../../../storage/db.ts", () => ({
  getDB: vi.fn(async () => fakeDb),
  registerDerivedSetting: vi.fn((_key: string, onCleared: () => void) => clearHooks.push(onCleared)),
}));

import { getBacklinks, removeFromBacklinks, setSourceLinks, updateBacklinks } from "../backlinks.ts";

function linkTo(...ids: string[]) {
  return [{ type: "paragraph", content: ids.map((entryId) => ({ type: "entryLink", props: { entryId } })) }] as never;
}

beforeEach(() => {
  settings.clear();
  writes.count = 0;
  clearHooks.forEach((hook) => hook());
  vi.clearAllMocks();
});

describe("setSourceLinks", () => {
  it("replaces a source's targets and skips self-links", () => {
    const index: Record<string, string[]> = { old: ["src"] };
    setSourceLinks(index, "src", linkTo("t1", "src"));
    expect(index).toEqual({ t1: ["src"] });
  });
});

describe("backlinks cache", () => {
  it("serves reads from memory after the first load", async () => {
    await updateBacklinks("a", linkTo("t"));
    expect(await getBacklinks("t")).toEqual(["a"]);
    expect(await getBacklinks("t")).toEqual(["a"]);
    expect(fakeDb.get).not.toHaveBeenCalled();
  });

  it("reflects writes immediately", async () => {
    await updateBacklinks("a", linkTo("t"));
    await getBacklinks("t");
    await removeFromBacklinks("a");
    expect(await getBacklinks("t")).toEqual([]);
  });

  it("reloads from storage after clear-all drops the cache", async () => {
    await updateBacklinks("a", linkTo("t"));
    settings.clear();
    clearHooks.forEach((hook) => hook());
    expect(await getBacklinks("t")).toEqual([]);
    expect(fakeDb.get).toHaveBeenCalledTimes(1);
  });
});

describe("updateBacklinks write skipping", () => {
  it("skips the write when the links did not change", async () => {
    await updateBacklinks("a", linkTo("t1", "t2"));
    expect(writes.count).toBe(1);
    await updateBacklinks("a", linkTo("t2", "t1"));
    await updateBacklinks("a", linkTo("a", "t1", "t2")); // self-link is ignored
    expect(writes.count).toBe(1);
  });

  it("skips the write for an entry without links", async () => {
    await updateBacklinks("a", []);
    expect(writes.count).toBe(1); // cold cache: first save loads and writes
    await updateBacklinks("a", []);
    expect(writes.count).toBe(1);
  });

  it("writes when a link is added or removed", async () => {
    await updateBacklinks("a", linkTo("t1"));
    await updateBacklinks("a", linkTo("t1", "t2"));
    expect(await getBacklinks("t2")).toEqual(["a"]);
    await updateBacklinks("a", linkTo("t2"));
    expect(await getBacklinks("t1")).toEqual([]);
    expect(writes.count).toBe(3);
  });
});
