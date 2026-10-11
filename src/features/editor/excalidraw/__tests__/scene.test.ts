import { describe, it, expect } from "vitest";
import { parseDrawingData, sceneKey, serializeScene } from "../scene.ts";

const rect = (id: string, version: number, extra: object = {}) => ({ id, type: "rectangle", version, ...extra });

describe("parseDrawingData", () => {
  it("returns ok with no snapshot for an empty block", () => {
    expect(parseDrawingData("")).toEqual({ ok: true, snapshot: null });
  });

  it("flags corrupt data instead of throwing", () => {
    expect(parseDrawingData("{not json")).toEqual({ ok: false });
    expect(parseDrawingData(JSON.stringify({ elements: "nope" }))).toEqual({ ok: false });
  });

  it("round-trips a serialized scene including referenced files", () => {
    const image = { id: "i", type: "image", version: 1, fileId: "f1" };
    const files = { f1: { id: "f1", dataURL: "data:image/png;base64,AA" }, orphan: { id: "orphan" } };
    const parsed = parseDrawingData(serializeScene({ elements: [image], viewBackgroundColor: "#fff", files }));
    expect(parsed.ok && parsed.snapshot).toEqual({
      elements: [image],
      viewBackgroundColor: "#fff",
      files: { f1: files.f1 },
    });
  });
});

describe("sceneKey", () => {
  const base = { elements: [rect("a", 1), rect("b", 3)], viewBackgroundColor: "#fff", files: null };

  it("is stable for the same scene (selection/scroll changes nothing stored)", () => {
    expect(sceneKey({ ...base, elements: [...base.elements] })).toBe(sceneKey(base));
  });

  it("changes when an element is edited, deleted, or the background changes", () => {
    expect(sceneKey({ ...base, elements: [rect("a", 2), rect("b", 3)] })).not.toBe(sceneKey(base));
    expect(sceneKey({ ...base, elements: [rect("a", 2, { isDeleted: true }), rect("b", 3)] })).not.toBe(sceneKey(base));
    expect(sceneKey({ ...base, viewBackgroundColor: "#000" })).not.toBe(sceneKey(base));
  });
});
