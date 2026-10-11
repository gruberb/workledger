import { describe, it, expect } from "vitest";
import type { WorkLedgerEntry } from "../../types/entry.ts";
import { formatWeekLabel, getISOWeekKey, getMondayDayKey, groupByWeek } from "../review-weeks.ts";

function entry(id: string, dayKey: string, createdAt: number): WorkLedgerEntry {
  return { id, dayKey, createdAt, updatedAt: createdAt, blocks: [], isArchived: false, tags: [] };
}

describe("ISO weeks", () => {
  it("maps day keys to ISO weeks across year boundaries", () => {
    expect(getISOWeekKey("2026-01-01")).toBe("2026-W01");
    expect(getISOWeekKey("2027-01-01")).toBe("2026-W53");
  });

  it("returns the Monday as a day key, independent of the local timezone", () => {
    expect(getMondayDayKey("2026-W02")).toBe("2026-01-05");
  });

  it("labels weeks relative to today", () => {
    expect(formatWeekLabel("2026-W02", "2026-01-07")).toBe("This Week");
    expect(formatWeekLabel("2026-W01", "2026-01-07")).toBe("Last Week");
    expect(formatWeekLabel("2025-W50", "2026-01-07")).toBe("Week of Dec 8");
  });
});

describe("groupByWeek", () => {
  it("does not reorder the caller's arrays", () => {
    const dayEntries = [entry("old", "2026-01-05", 1), entry("new", "2026-01-05", 2)];
    const weeks = groupByWeek(new Map([["2026-01-05", dayEntries]]), "2026-01-07");
    expect(weeks[0].days[0].entries.map((e) => e.id)).toEqual(["new", "old"]);
    expect(dayEntries.map((e) => e.id)).toEqual(["old", "new"]);
  });
});
