import { describe, it, expect } from "vitest";
import type { PartialBlock } from "@blocknote/core";
import type { WorkLedgerEntry } from "../../../entries/index.ts";
import { entryToMarkdown, markdownFileName, prepareBlocksForMarkdown } from "../entry-markdown.ts";

function entry(blocks: unknown[], extra: Partial<WorkLedgerEntry> = {}): WorkLedgerEntry {
  return { id: "e1", dayKey: "2026-10-11", createdAt: 1, updatedAt: 1, blocks: blocks as PartialBlock[], isArchived: false, tags: [], ...extra };
}

const text = (t: string) => [{ type: "text", text: t, styles: {} }];
const link = (displayText: string) => ({ type: "entryLink", props: { entryId: "x", displayText } });

describe("prepareBlocksForMarkdown", () => {
  it("keeps entry links as wiki-links, in paragraphs, nested children and table cells", () => {
    const [para, table] = prepareBlocksForMarkdown([
      { type: "paragraph", content: [{ type: "text", text: "See " }, link("Crawling RFD")], children: [{ type: "paragraph", content: [link("")] }] },
      { type: "table", content: { type: "tableContent", rows: [{ cells: [[link("A")], { type: "tableCell", content: [link("B")] }] }] } },
    ] as unknown as PartialBlock[]) as unknown as Record<string, any>[]; // eslint-disable-line @typescript-eslint/no-explicit-any
    expect(para.content[1]).toEqual({ type: "text", text: "[[Crawling RFD]]", styles: {} });
    expect(para.children[0].content[0].text).toBe("[[Untitled entry]]");
    expect(table.content.rows[0].cells[0][0].text).toBe("[[A]]");
    expect(table.content.rows[0].cells[1].content[0].text).toBe("[[B]]");
  });

  it("replaces drawings with a placeholder and leaves the input untouched", () => {
    const blocks = [{ type: "excalidraw", props: { previewSvg: "<svg/>" } }] as unknown as PartialBlock[];
    expect(prepareBlocksForMarkdown(blocks)).toEqual([{ type: "paragraph", content: "[Drawing]" }]);
    expect(blocks[0].type).toBe("excalidraw");
  });
});

describe("entryToMarkdown", () => {
  it("writes YAML front matter with title, date, tags, signifier and id before the body", () => {
    const e = entry([{ type: "heading", content: text('Crawling: strategy "v2"') }], { tags: ["image_service", "rfd work"], signifier: "rfd" });
    const md = entryToMarkdown(e, () => "BODY");
    expect(md).toBe(
      '---\ntitle: "Crawling: strategy \\"v2\\""\ndate: 2026-10-11\ntags: ["image_service","rfd work"]\nsignifier: rfd\nid: e1\n---\n\nBODY',
    );
  });

  it("omits empty tags and signifier", () => {
    expect(entryToMarkdown(entry([]), () => "")).toBe('---\ntitle: "Untitled entry"\ndate: 2026-10-11\nid: e1\n---\n\n');
  });
});

describe("markdownFileName", () => {
  it("uses the day and a slug of the title", () => {
    expect(markdownFileName(entry([{ type: "heading", content: text("Crawling Strategy / v2!") }]))).toBe("2026-10-11-crawling-strategy-v2.md");
    expect(markdownFileName(entry([{ type: "paragraph", content: text("日本語") }]))).toBe("2026-10-11.md");
  });
});
