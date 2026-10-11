import { describe, it, expect } from "vitest";
import { savableUpdates } from "../provider-draft.ts";
import { validateServerUrl } from "../../providers/url.ts";

const isValid = (url: string) => !validateServerUrl(url);

describe("savableUpdates", () => {
  it("drops half-typed URLs but keeps the other fields", () => {
    expect(savableUpdates({ ollamaUrl: "http://", ollamaModel: "llama3" }, isValid)).toEqual({ ollamaModel: "llama3" });
    expect(savableUpdates({ customUrl: "h", customApiKey: "sk" }, isValid)).toEqual({ customApiKey: "sk" });
  });

  it("keeps valid URLs", () => {
    expect(savableUpdates({ ollamaUrl: "http://localhost:11434" }, isValid)).toEqual({ ollamaUrl: "http://localhost:11434" });
  });
});
