import { describe, it, expect } from "vitest";
import type { EntryDocument } from "../../utils/entry-document.ts";
import { entryToDocx } from "../docx.ts";
import { entryToPdf } from "../pdf.tsx";
import type { RasterMap } from "../images.ts";

// Every block type, nesting, a failed image and characters outside the PDF fonts.
const doc: EntryDocument = {
  title: "Favicons",
  meta: "2026-10-15  ·  #rfd",
  blocks: [
    { type: "heading", depth: 0, level: 1, runs: [{ text: "Favicons → scraper" }] },
    { type: "paragraph", depth: 0, runs: [{ text: "bold", bold: true }, { text: " link", href: "https://example.com" }, { text: " code", code: true }] },
    { type: "paragraph", depth: 0, runs: [] },
    { type: "quote", depth: 0, runs: [{ text: "quoted 日本語 🙂" }] },
    { type: "bullet", depth: 0, runs: [{ text: "bullet" }] },
    { type: "number", depth: 1, number: 3, list: 0, runs: [{ text: "nested number" }] },
    { type: "check", depth: 0, checked: true, runs: [{ text: "done" }] },
    { type: "code", depth: 0, text: "fn main() {\n    println!(\"hi\");\n}" },
    { type: "table", depth: 0, headerRows: 1, rows: [[[{ text: "A" }], [{ text: "B" }]], [[{ text: "only one cell" }]]] },
    { type: "divider", depth: 0 },
    { type: "image", depth: 0, caption: "Fig", source: { kind: "url", url: "https://example.com/a.png" } },
  ],
};
const rasters: RasterMap = new Map();

async function bytes(blob: Blob): Promise<string> {
  return new TextDecoder("latin1").decode(await blob.arrayBuffer());
}

describe("export renderers", () => {
  it("writes a Word document", async () => {
    const out = await bytes(await entryToDocx(doc, rasters, "A4"));
    expect(out.startsWith("PK")).toBe(true);
    expect(out).toContain("word/document.xml");
  });

  it("writes a PDF", async () => {
    const out = await bytes(await entryToPdf(doc, rasters, "LETTER"));
    expect(out.startsWith("%PDF-")).toBe(true);
  }, 20_000);
});
