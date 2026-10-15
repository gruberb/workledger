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

  it("structure sections as H2 headings with text beneath, not labeled bullets", () => {
    for (const template of rfdTemplates) {
      const blocks = template.blocks as { type: string; props?: { level?: number }; content?: unknown }[];
      for (const title of ["Problem", "Outcome", "Scope", "Uncertainty", "Next check"]) {
        const i = blocks.findIndex((b) => b.type === "heading" && b.content === title);
        expect(blocks[i]?.props?.level, `${template.id}: ${title}`).toBe(2);
        expect(blocks[i + 1].type).toBe("paragraph");
      }
      expect(blocks[0]).toMatchObject({ type: "heading", props: { level: 1 } });
    }
  });
});
