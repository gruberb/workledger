import { describe, expect, it } from "vitest";
import { readStoredWidth, resolvePanelWidth } from "../useResizablePanel.ts";

const limits = { min: 240, max: 480, collapseBelow: 180 };

describe("resolvePanelWidth", () => {
  it("keeps widths inside the limits", () => {
    expect(resolvePanelWidth(300, limits)).toEqual({ width: 300, collapse: false });
  });

  it("clamps to max", () => {
    expect(resolvePanelWidth(900, limits)).toEqual({ width: 480, collapse: false });
  });

  it("clamps to min between the collapse threshold and min", () => {
    expect(resolvePanelWidth(200, limits)).toEqual({ width: 240, collapse: false });
  });

  it("asks to collapse below the threshold", () => {
    expect(resolvePanelWidth(179, limits)).toEqual({ width: 240, collapse: true });
    expect(resolvePanelWidth(-50, limits).collapse).toBe(true);
  });
});

describe("readStoredWidth", () => {
  it("uses a valid stored width", () => {
    expect(readStoredWidth("400", 320, limits)).toBe(400);
  });

  it("falls back for missing, garbage or out-of-range values", () => {
    expect(readStoredWidth(null, 320, limits)).toBe(320);
    expect(readStoredWidth("", 320, limits)).toBe(320);
    expect(readStoredWidth("wide", 320, limits)).toBe(320);
    expect(readStoredWidth("100", 320, limits)).toBe(320);
    expect(readStoredWidth("2000", 320, limits)).toBe(320);
  });
});
