import { describe, it, expect } from "vitest";
import type { WorkLedgerEntry } from "../../types/entry.ts";
import {
  addDayKey,
  keepIfSame,
  buildActiveSnapshot,
  removeFromMap,
  reuseUnchanged,
  updateInMap,
  upsertInMap,
} from "../entries-state.ts";

function entry(id: string, dayKey: string, createdAt: number, extra: Partial<WorkLedgerEntry> = {}): WorkLedgerEntry {
  return { id, dayKey, createdAt, updatedAt: createdAt, blocks: [], isArchived: false, tags: [], ...extra };
}

describe("buildActiveSnapshot", () => {
  const entries = [
    entry("a", "2026-01-03", 300),
    entry("b", "2026-01-03", 310),
    entry("c", "2026-01-02", 200),
    entry("d", "2026-01-01", 100),
    entry("old-pinned", "2025-06-01", 10, { isPinned: true }),
    entry("old-sibling", "2025-06-01", 11),
    entry("archived", "2025-05-01", 5, { isArchived: true }),
  ];

  it("counts archived entries without loading them unless asked", () => {
    const lean = buildActiveSnapshot(entries, { recentDays: 2 });
    expect(lean.archivedCount).toBe(1);
    expect(lean.archivedEntriesByDay).toBeUndefined();

    const full = buildActiveSnapshot(entries, { recentDays: 2, withArchive: true });
    expect([...full.archivedEntriesByDay!.entries()]).toEqual([["2025-05-01", [entries[6]]]]);
  });

  it("keeps the most recent days, newest entry first", () => {
    const { entriesByDay } = buildActiveSnapshot(entries, { recentDays: 2 });
    expect(entriesByDay.get("2026-01-03")?.map((e) => e.id)).toEqual(["b", "a"]);
    expect(entriesByDay.has("2026-01-02")).toBe(true);
    expect(entriesByDay.has("2026-01-01")).toBe(false);
  });

  it("includes whole days that hold a pinned entry outside the window", () => {
    const { entriesByDay } = buildActiveSnapshot(entries, { recentDays: 1 });
    expect(entriesByDay.get("2025-06-01")?.map((e) => e.id)).toEqual(["old-sibling", "old-pinned"]);
  });

  it("lists every active day key but never archived-only days", () => {
    const { dayKeys } = buildActiveSnapshot(entries, { recentDays: 1 });
    expect(dayKeys).toEqual(["2026-01-03", "2026-01-02", "2026-01-01", "2025-06-01"]);
  });

  it("keeps on-demand days and loads everything when asked", () => {
    expect(buildActiveSnapshot(entries, { recentDays: 1, extraDays: new Set(["2026-01-01"]) }).entriesByDay.has("2026-01-01")).toBe(true);
    expect(buildActiveSnapshot(entries, { recentDays: 1, all: true }).entriesByDay.size).toBe(4);
  });

  it("collects tags and signifiers from entries outside the recent window, but not archived ones", () => {
    const old = entry("old", "2025-01-01", 1, { tags: ["image_service"], signifier: "rfd" });
    const recent = entry("recent", "2026-10-11", 2, { tags: ["daily"] });
    const gone = entry("gone", "2026-10-10", 3, { tags: ["archived-only"], signifier: "idea", isArchived: true });
    const snapshot = buildActiveSnapshot([old, recent, gone], { recentDays: 1 });
    expect(snapshot.entriesByDay.has("2025-01-01")).toBe(false);
    expect(snapshot.allTags.sort()).toEqual(["daily", "image_service"]);
    expect(snapshot.allSignifiers).toEqual(["rfd"]);
  });
});

describe("map helpers", () => {
  const map = new Map([["2026-01-03", [entry("b", "2026-01-03", 310), entry("a", "2026-01-03", 300)]]]);

  it("upsert keeps newest-first order", () => {
    const next = upsertInMap(map, entry("mid", "2026-01-03", 305));
    expect(next.get("2026-01-03")?.map((e) => e.id)).toEqual(["b", "mid", "a"]);
    expect(map.get("2026-01-03")).toHaveLength(2);
  });

  it("update returns the same map when the entry is not loaded", () => {
    expect(updateInMap(map, "missing", (e) => e)).toBe(map);
    const next = updateInMap(map, "a", (e) => ({ ...e, tags: ["x"] }));
    expect(next.get("2026-01-03")?.[1].tags).toEqual(["x"]);
    // Untouched entries keep their identity so memoized cards skip re-rendering.
    expect(next.get("2026-01-03")?.[0]).toBe(map.get("2026-01-03")?.[0]);
  });

  it("remove drops a day once it is empty", () => {
    const once = removeFromMap(map, "a");
    expect(once.has("2026-01-03")).toBe(true);
    expect(removeFromMap(once, "b").has("2026-01-03")).toBe(false);
  });

  it("addDayKey keeps keys sorted and unique", () => {
    expect(addDayKey(["2026-01-03", "2026-01-01"], "2026-01-02")).toEqual(["2026-01-03", "2026-01-02", "2026-01-01"]);
    const keys = ["2026-01-03"];
    expect(addDayKey(keys, "2026-01-03")).toBe(keys);
  });
});

describe("reuseUnchanged", () => {
  const a = entry("a", "2026-01-02", 200);
  const b = entry("b", "2026-01-01", 100);
  const prev = new Map([["2026-01-02", [a]], ["2026-01-01", [b]]]);

  it("returns the previous map when the reload read the same versions", () => {
    const next = new Map([["2026-01-02", [{ ...a }]], ["2026-01-01", [{ ...b }]]]);
    expect(reuseUnchanged(prev, next)).toBe(prev);
  });

  it("keeps unchanged entries and days, and takes the changed entry", () => {
    const edited = { ...b, updatedAt: 150 };
    const next = new Map([["2026-01-02", [{ ...a }]], ["2026-01-01", [edited]]]);
    const merged = reuseUnchanged(prev, next);
    expect(merged).not.toBe(prev);
    expect(merged.get("2026-01-02")).toBe(prev.get("2026-01-02"));
    expect(merged.get("2026-01-01")![0]).toBe(edited);
  });

  it("picks up new entries, new days and removals", () => {
    const added = entry("c", "2026-01-02", 250);
    const withNew = reuseUnchanged(prev, new Map([["2026-01-02", [added, { ...a }]], ["2026-01-01", [{ ...b }]]]));
    expect(withNew.get("2026-01-02")!.map((e) => e.id)).toEqual(["c", "a"]);
    expect(withNew.get("2026-01-02")![1]).toBe(a);

    const removed = reuseUnchanged(prev, new Map([["2026-01-02", [{ ...a }]]]));
    expect(removed.has("2026-01-01")).toBe(false);
  });
});

describe("keepIfSame", () => {
  it("keeps the previous array only when the items match in order", () => {
    const prev = ["a", "b"];
    expect(keepIfSame(prev, ["a", "b"])).toBe(prev);
    const next = ["b", "a"];
    expect(keepIfSame(prev, next)).toBe(next);
  });
});
