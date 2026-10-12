import { describe, it, expect } from "vitest";
import type { EntrySignifier, WorkLedgerEntry } from "../../types/entry.ts";
import { filterDays, formatWeekLabel, summarizeWeek } from "../review-weeks.ts";

function entry(id: string, dayKey: string, createdAt: number, tags: string[] = [], signifier?: EntrySignifier): WorkLedgerEntry {
  return { id, dayKey, createdAt, updatedAt: createdAt, blocks: [], isArchived: false, tags, signifier };
}

describe("formatWeekLabel", () => {
  it("labels weeks relative to today", () => {
    expect(formatWeekLabel("2026-W02", "2026-01-07")).toBe("This week");
    expect(formatWeekLabel("2026-W01", "2026-01-07")).toBe("Last week");
    expect(formatWeekLabel("2025-W50", "2026-01-07")).toBe("Week of Dec 8");
  });
});

describe("summarizeWeek", () => {
  const byDay = new Map([
    ["2026-10-04", [entry("prev-week", "2026-10-04", 1, ["meeting"])]],
    ["2026-10-05", [entry("mon-a", "2026-10-05", 1, ["meeting"]), entry("mon-b", "2026-10-05", 2, ["meeting", "sync"], "rfd")]],
    ["2026-10-09", [entry("fri", "2026-10-09", 3, ["sync"], "decision")]],
  ]);

  it("includes only days of the week, newest day and entry first", () => {
    const week = summarizeWeek(byDay, "2026-W41", "2026-10-12");
    expect(week.days.map((d) => d.dayKey)).toEqual(["2026-10-09", "2026-10-05"]);
    expect(week.days[1].entries.map((e) => e.id)).toEqual(["mon-b", "mon-a"]);
    expect(week.entryCount).toBe(3);
    expect(week.label).toBe("Last week");
    expect(week.dateRange).toBe("Oct 5 – Oct 11, 2026");
  });

  it("counts signifiers and tags, most used first", () => {
    const week = summarizeWeek(byDay, "2026-W41", "2026-10-12");
    expect(week.tagCounts).toEqual([["meeting", 2], ["sync", 2]]);
    expect(week.signifierCounts).toEqual(expect.arrayContaining([["rfd", 1], ["decision", 1]]));
  });

  it("does not reorder the caller's arrays", () => {
    summarizeWeek(byDay, "2026-W41", "2026-10-12");
    expect(byDay.get("2026-10-05")!.map((e) => e.id)).toEqual(["mon-a", "mon-b"]);
  });

  it("returns an empty summary for a week without entries", () => {
    const week = summarizeWeek(byDay, "2026-W30", "2026-10-12");
    expect(week.days).toEqual([]);
    expect(week.entryCount).toBe(0);
  });
});

describe("filterDays", () => {
  const week = summarizeWeek(new Map([
    ["2026-10-05", [entry("a", "2026-10-05", 1, ["meeting"]), entry("b", "2026-10-05", 2, [], "rfd")]],
    ["2026-10-06", [entry("c", "2026-10-06", 3, ["sync"])]],
  ]), "2026-W41", "2026-10-12");

  it("keeps matching entries and drops empty days", () => {
    expect(filterDays(week.days, { kind: "tag", value: "meeting" }).flatMap((d) => d.entries.map((e) => e.id))).toEqual(["a"]);
    expect(filterDays(week.days, { kind: "signifier", value: "rfd" }).map((d) => d.dayKey)).toEqual(["2026-10-05"]);
    expect(filterDays(week.days, null)).toBe(week.days);
  });
});
