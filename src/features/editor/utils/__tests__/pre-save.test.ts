import { describe, it, expect } from "vitest";
import { registerPreSave, runPreSave } from "../pre-save.ts";

describe("pre-save hooks", () => {
  it("reports whether any hook changed the document, per editor", () => {
    const editor = {};
    const other = {};
    const unregisterClean = registerPreSave(editor, () => false);
    expect(runPreSave(editor)).toBe(false);

    const unregisterDirty = registerPreSave(editor, () => true);
    expect(runPreSave(editor)).toBe(true);
    expect(runPreSave(other)).toBe(false);

    unregisterDirty();
    unregisterClean();
    expect(runPreSave(editor)).toBe(false);
  });
});
