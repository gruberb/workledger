import { describe, it, expect } from "vitest";
import { isoWeekKey, mondayOfIsoWeek, previousIsoWeekKey, toDayKey, weekStartDayKey } from "../weeks.ts";

describe("isoWeekKey", () => {
  it.each([
    ["2026-10-11", "2026-W41"], // Sunday belongs to the week starting Monday 10-05
    ["2026-10-12", "2026-W42"],
    ["2021-01-03", "2020-W53"], // early January can belong to the previous ISO year
    ["2024-12-30", "2025-W01"], // late December can belong to the next ISO year
    ["2026-03-29", "2026-W13"], // DST switch day in Europe
  ])("%s -> %s", (dayKey, expected) => {
    expect(isoWeekKey(dayKey)).toBe(expected);
  });
});

describe("mondayOfIsoWeek", () => {
  it("returns local midnight of the Monday", () => {
    const monday = mondayOfIsoWeek("2026-W41");
    expect(toDayKey(monday)).toBe("2026-10-05");
    expect(monday.getDay()).toBe(1);
    expect(monday.getHours()).toBe(0);
  });

  it("round-trips with isoWeekKey across year boundaries", () => {
    expect(toDayKey(mondayOfIsoWeek("2020-W53"))).toBe("2020-12-28");
    expect(toDayKey(mondayOfIsoWeek("2025-W01"))).toBe("2024-12-30");
  });
});

describe("previousIsoWeekKey", () => {
  it("steps back across a year boundary", () => {
    expect(previousIsoWeekKey("2025-W01")).toBe("2024-W52");
  });
});

describe("weekStartDayKey", () => {
  it("uses the local calendar, not UTC", () => {
    // Monday 00:30 local: a UTC-based calculation east of UTC lands on Sunday.
    expect(weekStartDayKey(new Date(2026, 9, 12, 0, 30))).toBe("2026-10-12");
    // Sunday 23:30 local: a UTC-based calculation west of UTC lands on Monday.
    expect(weekStartDayKey(new Date(2026, 9, 11, 23, 30))).toBe("2026-10-05");
  });
});
