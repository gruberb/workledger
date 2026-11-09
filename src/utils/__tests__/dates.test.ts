import { describe, expect, it } from "vitest";
import { formatDayParts } from "../dates.ts";

describe("formatDayParts", () => {
  const now = new Date(2026, 10, 9, 15, 0); // Monday, November 9, 2026

  it("names today and yesterday and shows the date beside them", () => {
    expect(formatDayParts("2026-11-09", now)).toEqual({ name: "Today", detail: "Monday, November 9" });
    expect(formatDayParts("2026-11-08", now)).toEqual({ name: "Yesterday", detail: "Sunday, November 8" });
  });

  it("names older days by weekday with the full date", () => {
    expect(formatDayParts("2026-11-05", now)).toEqual({ name: "Thursday", detail: "November 5, 2026" });
  });

  it("finds yesterday across a month boundary", () => {
    expect(formatDayParts("2026-10-31", new Date(2026, 10, 1)).name).toBe("Yesterday");
  });
});
