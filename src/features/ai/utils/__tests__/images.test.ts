import { describe, it, expect } from "vitest";
import { fitWithin } from "../images.ts";

describe("fitWithin", () => {
  it("scales the longest edge down to the limit, keeping the aspect ratio", () => {
    expect(fitWithin(3136, 1568, 1568)).toEqual({ width: 1568, height: 784 });
    expect(fitWithin(1000, 4000, 1568)).toEqual({ width: 392, height: 1568 });
  });

  it("never enlarges small images", () => {
    expect(fitWithin(800, 600, 1568)).toEqual({ width: 800, height: 600 });
  });
});
