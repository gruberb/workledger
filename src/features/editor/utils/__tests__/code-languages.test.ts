import { describe, it, expect } from "vitest";
import { resolveCodeLanguage } from "../code-languages.ts";

const SUPPORTED = {
  text: { name: "Plain Text" },
  javascript: { name: "JavaScript", aliases: ["js"] },
};

describe("resolveCodeLanguage", () => {
  it("keeps supported ids", () => {
    expect(resolveCodeLanguage("javascript", SUPPORTED, "text")).toBe("javascript");
  });

  it("resolves aliases case-insensitively", () => {
    expect(resolveCodeLanguage(" JS ", SUPPORTED, "text")).toBe("javascript");
  });

  it("falls back for unknown or missing languages", () => {
    expect(resolveCodeLanguage("http", SUPPORTED, "text")).toBe("text");
    expect(resolveCodeLanguage("", SUPPORTED, "text")).toBe("text");
    expect(resolveCodeLanguage(undefined, SUPPORTED, "text")).toBe("text");
  });
});
