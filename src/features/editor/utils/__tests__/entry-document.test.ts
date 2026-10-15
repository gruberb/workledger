import { describe, it, expect } from "vitest";
import type { PartialBlock } from "@blocknote/core";
import type { WorkLedgerEntry } from "../../../entries/index.ts";
import { entryToDocument, toRuns } from "../entry-document.ts";

function entry(blocks: unknown[], extra: Partial<WorkLedgerEntry> = {}): WorkLedgerEntry {
  return { id: "e1", dayKey: "2026-10-15", createdAt: 1, updatedAt: 1, blocks: blocks as PartialBlock[], isArchived: false, tags: [], ...extra };
}

const text = (t: string, styles = {}) => [{ type: "text", text: t, styles }];

describe("toRuns", () => {
  it("keeps styles, safe links and entry link titles", () => {
    expect(toRuns([
      { type: "text", text: "bold", styles: { bold: true, textColor: "gray" } },
      { type: "link", href: "https://example.com", content: text("site", { italic: true }) },
      { type: "entryLink", props: { entryId: "x", displayText: "Crawling RFD" } },
    ])).toEqual([
      { text: "bold", bold: true },
      { text: "site", italic: true, href: "https://example.com" },
      { text: "Crawling RFD" },
    ]);
  });

  it("drops links with unsafe schemes but keeps their text", () => {
    expect(toRuns([{ type: "link", href: "javascript:alert(1)", content: text("click") }])).toEqual([{ text: "click" }]);
  });
});

describe("entryToDocument", () => {
  it("flattens children with their depth", () => {
    const doc = entryToDocument(entry([
      { type: "bulletListItem", content: text("parent"), children: [{ type: "checkListItem", props: { checked: true }, content: text("child") }] },
    ]));
    expect(doc.blocks).toEqual([
      { type: "bullet", depth: 0, runs: [{ text: "parent" }] },
      { type: "check", depth: 1, checked: true, runs: [{ text: "child" }] },
    ]);
  });

  it("numbers each run of list items separately and honors start", () => {
    const doc = entryToDocument(entry([
      { type: "numberedListItem", props: { start: 3 }, content: text("a"), children: [{ type: "numberedListItem", content: text("a1") }] },
      { type: "numberedListItem", content: text("b") },
      { type: "paragraph", content: text("break") },
      { type: "numberedListItem", content: text("c") },
    ]));
    const numbers = doc.blocks.flatMap((b) => (b.type === "number" ? [[b.number, b.list, b.depth]] : []));
    // a and b share a list; the nested item and c start their own.
    expect(numbers).toEqual([[3, 0, 0], [1, 1, 1], [4, 0, 0], [1, 2, 0]]);
  });

  it("maps tables, code, drawings and images, and skips images without a source", () => {
    const doc = entryToDocument(entry([
      { type: "table", content: { type: "tableContent", headerRows: 1, rows: [{ cells: [{ type: "tableCell", content: text("H") }, text("plain")] }] } },
      { type: "codeBlock", props: { language: "ts" }, content: text("const a = 1;\nconst b = 2;") },
      { type: "excalidraw", props: { previewSvg: "<svg/>", previewKey: "k", drawingData: "" } },
      { type: "image", props: { url: "https://example.com/a.png", caption: "Fig" } },
      { type: "image", props: { url: "" } },
      { type: "excalidraw", props: { previewSvg: "", drawingData: "" } },
    ]));
    expect(doc.blocks).toEqual([
      { type: "table", depth: 0, headerRows: 1, rows: [[[{ text: "H" }], [{ text: "plain" }]]] },
      { type: "code", depth: 0, text: "const a = 1;\nconst b = 2;" },
      { type: "image", depth: 0, caption: "", source: { kind: "drawing", previewSvg: "<svg/>", previewKey: "k", drawingData: "" } },
      { type: "image", depth: 0, caption: "Fig", source: { kind: "url", url: "https://example.com/a.png" } },
    ]);
  });

  it("keeps media blocks as links instead of dropping them", () => {
    const doc = entryToDocument(entry([{ type: "file", props: { url: "https://example.com/spec.pdf", name: "spec.pdf" } }]));
    expect(doc.blocks[0]).toEqual({ type: "paragraph", depth: 0, runs: [{ text: "File: " }, { text: "spec.pdf", href: "https://example.com/spec.pdf" }] });
  });

  it("puts date, signifier and tags in the meta line and the first heading in the title", () => {
    const doc = entryToDocument(entry([{ type: "heading", props: { level: 2 }, content: text("Favicons") }], { tags: ["rfd"], signifier: "decision" }));
    expect(doc.title).toBe("Favicons");
    expect(doc.meta).toBe("2026-10-15  ·  Decision  ·  #rfd");
    expect(doc.blocks[0]).toEqual({ type: "heading", depth: 0, level: 2, runs: [{ text: "Favicons" }] });
  });
});
