// PDF export, laid out by @react-pdf/renderer. The library is imported on
// demand inside `entryToPdf` so it lands in its own chunk, which the service
// worker doesn't precache; its components are passed down instead of imported.
import type { Styles } from "@react-pdf/renderer";
import type { ReactElement } from "react";
import type { DocBlock, EntryDocument, TextRun } from "../utils/entry-document.ts";
import { imageFallbackText, type RasterMap } from "./images.ts";
import { PAGE_MARGIN_PT, PAGE_SIZES, type PageSize } from "./page.ts";
import { fitToFont, isWinAnsi, type HasGlyph } from "./font-text.ts";
import type { PdfFontFiles } from "./fonts.ts";
import { BODY_PT, DOCUMENT_FONT, HEADINGS, LINE_HEIGHT, LINK_COLOR, LIST_ITEM_AFTER_PT, PARAGRAPH_AFTER_PT } from "./style.ts";

type Pdf = typeof import("@react-pdf/renderer");
type Style = Styles[string];

/** The renderer's components plus the glyph coverage of the document font. */
interface Kit {
  P: Pdf;
  hasGlyph: HasGlyph;
}

const INDENT_PT = 16;
const PX_TO_PT = 0.75;
const MUTED = "#666666";
const BORDER = "#CCCCCC";
const NBSP = " ";
const UNBROKEN_TABLE_ROWS = 12;

interface Emphasis {
  bold?: boolean;
  italic?: boolean;
}

function fontStyle({ bold, italic }: Emphasis, mono = false): Style {
  if (mono) {
    // Courier is a standard PDF font: each variant is its own font name.
    const variant = bold && italic ? "-BoldOblique" : bold ? "-Bold" : italic ? "-Oblique" : "";
    return { fontFamily: `Courier${variant}` };
  }
  return { fontFamily: DOCUMENT_FONT, fontWeight: bold ? 700 : 400, fontStyle: italic ? "italic" : "normal" };
}

function runStyle(run: TextRun, base: Emphasis): Style {
  return {
    ...fontStyle({ bold: run.bold || base.bold, italic: run.italic || base.italic }, run.code),
    ...(run.underline || run.strike || run.href
      ? { textDecoration: run.strike ? "line-through" : "underline" }
      : {}),
    ...(run.code ? { backgroundColor: "#EEEEEE" } : {}),
    ...(run.href ? { color: LINK_COLOR } : {}),
  };
}

function runText(k: Kit, run: TextRun): string {
  return fitToFont(run.text, run.code ? isWinAnsi : k.hasGlyph);
}

/** A paragraph of runs. Empty paragraphs keep their line, as in the editor. */
function renderRuns(k: Kit, runs: TextRun[], style: Style = {}, base: Emphasis = {}): ReactElement {
  const { P } = k;
  const paragraph = { ...style, ...fontStyle(base) };
  if (runs.length === 0) return <P.Text style={paragraph}>{NBSP}</P.Text>;
  return (
    <P.Text style={paragraph}>
      {runs.map((run, i) =>
        run.href ? (
          <P.Link key={i} src={run.href} style={runStyle(run, base)}>{runText(k, run)}</P.Link>
        ) : (
          <P.Text key={i} style={runStyle(run, base)}>{runText(k, run)}</P.Text>
        ),
      )}
    </P.Text>
  );
}

/** The layout engine drops leading spaces, so indentation becomes no-break spaces. */
function codeText(text: string): string {
  return fitToFont(text, isWinAnsi).replace(/^[ \t]+/gm, (indent) => NBSP.repeat(indent.replace(/\t/g, "    ").length)) || NBSP;
}

/** List row: a fixed-width marker column keeps wrapped lines aligned with the text. */
function renderListRow(k: Kit, marker: ReactElement, runs: TextRun[], style: Style = {}): ReactElement {
  const { P } = k;
  return (
    <P.View style={{ flexDirection: "row" }}>
      <P.View style={{ width: 18 }}>{marker}</P.View>
      <P.View style={{ flex: 1 }}>{renderRuns(k, runs, style)}</P.View>
    </P.View>
  );
}

function renderTable(k: Kit, b: Extract<DocBlock, { type: "table" }>): ReactElement {
  const { P } = k;
  const columns = Math.max(1, ...b.rows.map((r) => r.length));
  return (
    <P.View wrap={b.rows.length > UNBROKEN_TABLE_ROWS} style={{ borderTop: `1 solid ${BORDER}`, borderLeft: `1 solid ${BORDER}` }}>
      {b.rows.map((cells, r) => (
        // A row split across two pages is hard to read. Long tables still break between rows,
        // but react-pdf can misplace the row after an unbreakable one at a page end, so short
        // tables move to the next page whole instead.
        <P.View key={r} wrap={false} style={{ flexDirection: "row", backgroundColor: r < b.headerRows ? "#F2F2F2" : undefined }}>
          {Array.from({ length: columns }, (_, c) => (
            <P.View key={c} style={{ flex: 1, padding: 4, borderRight: `1 solid ${BORDER}`, borderBottom: `1 solid ${BORDER}` }}>
              {renderRuns(k, cells[c] ?? [], {}, { bold: r < b.headerRows })}
            </P.View>
          ))}
        </P.View>
      ))}
    </P.View>
  );
}

function renderImage(k: Kit, b: Extract<DocBlock, { type: "image" }>, rasters: RasterMap, contentPt: number): ReactElement {
  const { P } = k;
  const raster = rasters.get(b.source);
  const caption = b.caption ? renderRuns(k, [{ text: b.caption }], { fontSize: 9, color: MUTED, marginTop: 4 }, { italic: true }) : null;
  if (!raster) return <P.View>{renderRuns(k, [{ text: imageFallbackText(b.source) }], { color: MUTED })}{caption}</P.View>;
  const width = Math.min(contentPt - b.depth * INDENT_PT, raster.width * PX_TO_PT);
  return (
    <P.View wrap={false}>
      <P.Image src={raster.dataUrl} style={{ width, height: (width * raster.height) / raster.width }} />
      {caption}
    </P.View>
  );
}

function renderBlock(k: Kit, b: DocBlock, rasters: RasterMap, contentPt: number): ReactElement {
  const { P } = k;
  switch (b.type) {
    case "heading":
      return renderRuns(k, b.runs, { fontSize: HEADINGS[b.level - 1].size, lineHeight: 1.2 });
    case "paragraph":
      return renderRuns(k, b.runs);
    case "quote":
      return (
        <P.View style={{ borderLeft: "2 solid #BBBBBB", paddingLeft: 8 }}>
          {renderRuns(k, b.runs, { color: "#444444" }, { italic: true })}
        </P.View>
      );
    case "bullet":
      return renderListRow(k, <P.Text>•</P.Text>, b.runs);
    case "number":
      return renderListRow(k, <P.Text>{`${b.number}.`}</P.Text>, b.runs);
    case "check":
      return renderListRow(
        k,
        <P.View style={{ width: 8, height: 8, marginTop: 3.5, border: "1 solid #555555", backgroundColor: b.checked ? "#555555" : undefined }} />,
        b.runs,
        b.checked ? { textDecoration: "line-through", color: MUTED } : {},
      );
    case "code":
      return (
        <P.View style={{ backgroundColor: "#F5F5F5", padding: 8 }}>
          <P.Text style={{ fontFamily: "Courier", fontSize: 9, lineHeight: 1.35 }}>{codeText(b.text)}</P.Text>
        </P.View>
      );
    case "table":
      return renderTable(k, b);
    case "divider":
      return <P.View style={{ borderBottom: `1 solid ${BORDER}`, marginVertical: 6 }} />;
    case "image":
      return renderImage(k, b, rasters, contentPt);
  }
}

/** Space around a block, matching the paragraph and heading spacing of the Word export. */
function blockSpacing(b: DocBlock): Style {
  if (b.type === "heading") {
    const { before, after } = HEADINGS[b.level - 1];
    return { marginTop: before, marginBottom: after };
  }
  const listItem = b.type === "bullet" || b.type === "number" || b.type === "check";
  return { marginBottom: listItem ? LIST_ITEM_AFTER_PT : PARAGRAPH_AFTER_PT };
}

/** Registers the document font once; registering again would add duplicate sources. */
function registerFont(P: Pdf, files: PdfFontFiles) {
  if (P.Font.getRegisteredFontFamilies().includes(DOCUMENT_FONT)) return;
  P.Font.register({
    family: DOCUMENT_FONT,
    fonts: [
      { src: files.regular, fontWeight: 400 },
      { src: files.bold, fontWeight: 700 },
      { src: files.italic, fontWeight: 400, fontStyle: "italic" },
      { src: files.boldItalic, fontWeight: 700, fontStyle: "italic" },
    ],
  });
}

/** Loads the regular face up front (it fails here if the font can't be fetched) to read its glyph coverage. */
async function documentFontCoverage(P: Pdf): Promise<HasGlyph> {
  await P.Font.load({ fontFamily: DOCUMENT_FONT, fontWeight: 400 });
  const font = P.Font.getFont({ fontFamily: DOCUMENT_FONT, fontWeight: 400 }).data;
  if (!font) throw new Error(`${DOCUMENT_FONT} did not load`);
  return (codePoint) => font.hasGlyphForCodePoint(codePoint);
}

export async function entryToPdf(doc: EntryDocument, rasters: RasterMap, pageSize: PageSize, fonts: PdfFontFiles): Promise<Blob> {
  const P = await import("@react-pdf/renderer");
  // Hyphenation splits identifiers and table headers ("evi-dence").
  P.Font.registerHyphenationCallback((word) => [word]);
  registerFont(P, fonts);
  const k: Kit = { P, hasGlyph: await documentFontCoverage(P) };
  const contentPt = PAGE_SIZES[pageSize].width - 2 * PAGE_MARGIN_PT;
  const document = (
    <P.Document title={doc.title} creator="WorkLedger" producer="WorkLedger">
      <P.Page size={pageSize} style={{ padding: PAGE_MARGIN_PT, ...fontStyle({}), fontSize: BODY_PT, lineHeight: LINE_HEIGHT, color: "#000000" }}>
        <P.Text style={{ fontSize: 9, color: MUTED, marginBottom: 12 }}>{fitToFont(doc.meta, k.hasGlyph)}</P.Text>
        {doc.blocks.map((b, i) => (
          <P.View key={i} style={{ marginLeft: b.depth * INDENT_PT, ...blockSpacing(b) }}>
            {renderBlock(k, b, rasters, contentPt)}
          </P.View>
        ))}
      </P.Page>
    </P.Document>
  );
  return P.pdf(document).toBlob();
}
