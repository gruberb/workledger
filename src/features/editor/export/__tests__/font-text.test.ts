import { describe, it, expect } from "vitest";
import { fitToFont, isWinAnsi } from "../font-text.ts";
import { localPageSize } from "../page.ts";

describe("fitToFont", () => {
  it("keeps Latin-1 and Windows-1252 punctuation for the standard fonts", () => {
    expect(fitToFont("Größe café “quoted” – € • …\n\ttab", isWinAnsi)).toBe("Größe café “quoted” – € • …\n\ttab");
  });

  it("replaces common symbols the font lacks and marks the rest", () => {
    expect(fitToFont("a → b ≥ c ✓", isWinAnsi)).toBe("a -> b >= c v");
    expect(fitToFont("日本 🙂", isWinAnsi)).toBe("?? ?");
  });

  it("keeps whatever the font has, beyond Windows-1252", () => {
    const greekAndArrows = (code: number) => isWinAnsi(code) || code === 0x2192 || (code >= 0x370 && code <= 0x3ff);
    expect(fitToFont("λ → 日", greekAndArrows)).toBe("λ → ?");
  });
});

describe("localPageSize", () => {
  it("uses Letter in the US and Canada, A4 elsewhere", () => {
    expect(localPageSize("en-US")).toBe("LETTER");
    expect(localPageSize("fr-CA")).toBe("LETTER");
    expect(localPageSize("en-GB")).toBe("A4");
    expect(localPageSize("de")).toBe("A4");
  });
});
