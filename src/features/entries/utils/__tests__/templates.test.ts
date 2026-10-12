import { describe, it, expect } from "vitest";
import { ENTRY_TEMPLATES } from "../templates.ts";
import { validateEntry } from "../validation.ts";

const rfdTemplates = ENTRY_TEMPLATES.filter((t) => t.id.startsWith("rfd-"));

describe("RFD templates", () => {
  it("exist in brief and full variants and carry the rfd signifier", () => {
    expect(rfdTemplates.map((t) => t.id)).toEqual(["rfd-brief", "rfd-full"]);
    for (const template of rfdTemplates) {
      expect(template.signifier).toBe("rfd");
      // The project is the user's tag to add; a fixed tag would pollute every project filter.
      expect(template.tag).toBeUndefined();
    }
  });

  it("produce entries that keep the rfd signifier through validation (import and sync path)", () => {
    for (const template of rfdTemplates) {
      const entry = validateEntry({
        id: "e1",
        dayKey: "2026-10-11",
        createdAt: 1,
        updatedAt: 1,
        blocks: template.blocks,
        tags: ["image_service"],
        signifier: template.signifier,
      });
      expect(entry.signifier).toBe("rfd");
      expect(entry.blocks).toHaveLength(template.blocks.length);
    }
  });

  it("builds tables whose rows all match the header width", () => {
    for (const template of rfdTemplates) {
      for (const block of template.blocks) {
        if (block.type !== "table") continue;
        const content = block.content as { rows: { cells: unknown[] }[] };
        const width = content.rows[0].cells.length;
        expect(content.rows.every((row) => row.cells.length === width)).toBe(true);
      }
    }
  });
});
