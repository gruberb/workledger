import { describe, it, expect } from "vitest";
import { toWinAnsi } from "../winansi.ts";
import { localPageSize } from "../page.ts";

describe("toWinAnsi", () => {
  it("keeps Latin-1 and Windows-1252 punctuation", () => {
    expect(toWinAnsi("Größe café “quoted” – € • …\n\ttab")).toBe("Größe café “quoted” – € • …\n\ttab");
  });

  it("replaces common symbols and marks the rest", () => {
    expect(toWinAnsi("a → b ≥ c ✓")).toBe("a -> b >= c v");
    expect(toWinAnsi("日本 🙂")).toBe("?? ?");
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
