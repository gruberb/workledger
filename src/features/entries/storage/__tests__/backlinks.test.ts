import { describe, it, expect, vi, beforeEach } from "vitest";

// Minimal in-memory stand-in for the settings store. vi.hoisted because
// vi.mock factories run before module-level code.
const { settings, clearHooks, fakeDb } = vi.hoisted(() => {
  const settings = new Map<string, { key: string; value: string }>();
  const store = {
    get: async (key: string) => settings.get(key),
    put: async (row: { key: string; value: string }) => { settings.set(row.key, row); },
  };
  return {
    settings,
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
