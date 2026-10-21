import { describe, it, expect } from "vitest";
import { buildMessages, renderUserPrompt } from "../prompt-builder.ts";

describe("renderUserPrompt", () => {
  it("inserts note text verbatim, including replacement patterns", () => {
    expect(renderUserPrompt("Note: {{noteContent}}", "costs $& and $' rise")).toBe("Note: costs $& and $' rise");
  });
});

describe("buildMessages", () => {
  it("passes images through and leaves text-only messages without the field", () => {
    const image = { mediaType: "image/jpeg" as const, data: "abc" };
    const messages = buildMessages("system", [
      { id: "1", role: "user", content: "look", timestamp: 0, images: [image] },
      { id: "2", role: "assistant", content: "ok", timestamp: 0 },
    ]);
    expect(messages).toEqual([
      { role: "system", content: "system" },
      { role: "user", content: "look", images: [image] },
      { role: "assistant", content: "ok" },
    ]);
  });
});
