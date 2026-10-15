// Word export. `docx` is imported on demand inside `entryToDocx` (not at the
// top) so it lands in its own chunk, which the service worker doesn't precache.
import type { FileChild, INumberingOptions, IRunOptions, ParagraphChild } from "docx";
import type { DocBlock, EntryDocument, TextRun } from "../utils/entry-document.ts";
import { imageFallbackText, type RasterMap } from "./images.ts";
import { PAGE_MARGIN_PT, PAGE_SIZES, type PageSize } from "./page.ts";

type Docx = typeof import("docx");

const twips = (pt: number) => Math.round(pt * 20);
const INDENT = 360;
const MONO = "Courier New";

function runOptions(run: TextRun, extra: Partial<IRunOptions> = {}): IRunOptions {
  return {
    text: run.text,
    bold: run.bold,
    italics: run.italic,
    underline: run.underline ? {} : undefined,
    strike: run.strike,
    ...(run.code ? { font: MONO, shading: { type: "clear", fill: "EEEEEE", color: "auto" } } : {}),
    ...extra,
  };
}

function inline(D: Docx, runs: TextRun[], extra: Partial<IRunOptions> = {}): ParagraphChild[] {
  return runs.map((run) =>
    run.href
      ? new D.ExternalHyperlink({ link: run.href, children: [new D.TextRun({ ...runOptions(run, extra), style: "Hyperlink" })] })
      : new D.TextRun(runOptions(run, extra)),
  );
}

function table(D: Docx, block: Extract<DocBlock, { type: "table" }>, contentTwips: number) {
  const columns = Math.max(1, ...block.rows.map((r) => r.length));
  const columnWidth = Math.floor((contentTwips - block.depth * INDENT) / columns);
  return new D.Table({
    // Google Docs ignores percentage widths on import and needs explicit columns.
    columnWidths: Array.from({ length: columns }, () => columnWidth),
    indent: block.depth ? { size: block.depth * INDENT, type: D.WidthType.DXA } : undefined,
    rows: block.rows.map((cells, r) => {
      const header = r < block.headerRows;
      return new D.TableRow({
        tableHeader: header,
        children: Array.from({ length: columns }, (_, c) =>
          new D.TableCell({
            width: { size: columnWidth, type: D.WidthType.DXA },
            shading: header ? { type: D.ShadingType.CLEAR, fill: "F2F2F2", color: "auto" } : undefined,
            children: [new D.Paragraph({ children: inline(D, cells[c] ?? [], header ? { bold: true } : {}) })],
          }),
        ),
      });
    }),
  });
}

function block(D: Docx, b: DocBlock, rasters: RasterMap, contentPx: number, contentTwips: number): FileChild {
  const indent = b.depth ? { left: b.depth * INDENT } : undefined;
  switch (b.type) {
    case "heading":
      return new D.Paragraph({ heading: D.HeadingLevel[`HEADING_${b.level}`], indent, children: inline(D, b.runs) });
    case "paragraph":
      return new D.Paragraph({ indent, children: inline(D, b.runs) });
    case "quote":
      return new D.Paragraph({
        indent: { left: (b.depth + 1) * INDENT },
        border: { left: { style: D.BorderStyle.SINGLE, size: 12, color: "BBBBBB", space: 8 } },
        children: inline(D, b.runs, { italics: true }),
      });
    case "bullet":
      return new D.Paragraph({ bullet: { level: Math.min(b.depth, 8) }, children: inline(D, b.runs) });
    case "number":
      return new D.Paragraph({ numbering: { reference: `list-${b.list}`, level: Math.min(b.depth, 8) }, children: inline(D, b.runs) });
    case "check":
      return new D.Paragraph({
        indent,
        children: [new D.TextRun(b.checked ? "☑ " : "☐ "), ...inline(D, b.runs, b.checked ? { strike: true } : {})],
      });
    case "code":
      return new D.Paragraph({
        indent,
        shading: { type: D.ShadingType.CLEAR, fill: "F5F5F5", color: "auto" },
        children: b.text.split("\n").map((line, i) => new D.TextRun({ text: line, font: MONO, size: 18, break: i > 0 ? 1 : undefined })),
      });
    case "table":
      return table(D, b, contentTwips);
    case "divider":
      return new D.Paragraph({ border: { bottom: { style: D.BorderStyle.SINGLE, size: 6, color: "CCCCCC", space: 4 } }, children: [] });
    case "image": {
      const raster = rasters.get(b.source);
      const caption = b.caption ? [new D.TextRun({ text: b.caption, italics: true, break: 1 })] : [];
      if (!raster) return new D.Paragraph({ indent, children: [new D.TextRun(imageFallbackText(b.source)), ...caption] });
      const scale = Math.min(1, (contentPx - b.depth * 24) / raster.width);
      return new D.Paragraph({
        indent,
        children: [
          new D.ImageRun({ type: "png", data: raster.dataUrl, transformation: { width: raster.width * scale, height: raster.height * scale } }),
          ...caption,
        ],
      });
    }
  }
}

/** One numbering definition per list, so each list starts at its own first number. */
function numbering(D: Docx, blocks: DocBlock[]): INumberingOptions {
  const starts = new Map<number, number>();
  for (const b of blocks) if (b.type === "number" && !starts.has(b.list)) starts.set(b.list, b.number);
  return {
    config: [...starts].map(([list, start]) => ({
      reference: `list-${list}`,
      levels: Array.from({ length: 9 }, (_, level) => ({
        level,
        format: D.LevelFormat.DECIMAL,
        text: `%${level + 1}.`,
        start,
        alignment: D.AlignmentType.START,
        style: { paragraph: { indent: { left: (level + 1) * 2 * INDENT, hanging: INDENT } } },
      })),
    })),
  };
}

export async function entryToDocx(doc: EntryDocument, rasters: RasterMap, pageSize: PageSize): Promise<Blob> {
  const D = await import("docx");
  const page = PAGE_SIZES[pageSize];
  const contentPt = page.width - 2 * PAGE_MARGIN_PT;
  const margin = twips(PAGE_MARGIN_PT);
  // Word lays images out at 96 pixels per inch.
  const contentPx = (contentPt / 72) * 96;
  const document = new D.Document({
    title: doc.title,
    numbering: numbering(D, doc.blocks),
    sections: [{
      properties: {
        page: {
          size: { width: twips(page.width), height: twips(page.height) },
          margin: { top: margin, bottom: margin, left: margin, right: margin },
        },
      },
      children: [
        new D.Paragraph({ spacing: { after: 240 }, children: [new D.TextRun({ text: doc.meta, size: 18, color: "666666" })] }),
        ...doc.blocks.map((b) => block(D, b, rasters, contentPx, twips(contentPt))),
      ],
    }],
  });
  return D.Packer.toBlob(document);
}
