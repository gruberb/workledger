import { describe, it, expect } from "vitest";
import type { WorkLedgerEntry } from "../../../entries/index.ts";
import { filterEntries, type DayFilterCache } from "../filterEntries.ts";

function entry(id: string, tags: string[], extra: Partial<WorkLedgerEntry> = {}): WorkLedgerEntry {
  return { id, dayKey: "d", createdAt: 1, updatedAt: 1, blocks: [], isArchived: false, tags, ...extra };
}

describe("filterEntries", () => {
  const day1 = [entry("a", ["x"]), entry("b", ["y"])];
  const day2 = [entry("c", ["y"], { signifier: "idea" })];
  const byDay = new Map([["2026-01-02", day1], ["2026-01-01", day2]]);

  it("requires every tag and drops days left empty", () => {
    const result = filterEntries(byDay, ["x"], []);
    expect([...result.keys()]).toEqual(["2026-01-02"]);
    expect(result.get("2026-01-02")!.map((e) => e.id)).toEqual(["a"]);
  });

  it("matches any selected signifier", () => {
    const result = filterEntries(byDay, [], ["idea", "decision"]);
    expect([...result.get("2026-01-01")!.map((e) => e.id)]).toEqual(["c"]);
  });

  it("filters only days whose array changed when given a cache", () => {
    const cache: DayFilterCache = new WeakMap();
    const first = filterEntries(byDay, ["y"], [], cache);

    // A save replaces one day's array and shares the rest.
    const edited = [entry("c", ["y"], { signifier: "idea", updatedAt: 2 })];
    const second = filterEntries(new Map([["2026-01-02", day1], ["2026-01-01", edited]]), ["y"], [], cache);

    expect(second.get("2026-01-02")).toBe(first.get("2026-01-02"));
    expect(second.get("2026-01-01")).not.toBe(first.get("2026-01-01"));
    expect(second.get("2026-01-01")![0].updatedAt).toBe(2);
  });
});
