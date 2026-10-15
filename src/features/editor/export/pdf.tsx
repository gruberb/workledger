// PDF export, laid out by @react-pdf/renderer. The library is imported on
// demand inside `entryToPdf` so it lands in its own chunk, which the service
// worker doesn't precache; its components are passed down instead of imported.
import type { Styles } from "@react-pdf/renderer";
import type { ReactElement } from "react";
import type { DocBlock, EntryDocument, TextRun } from "../utils/entry-document.ts";
import { imageFallbackText, type RasterMap } from "./images.ts";
import { PAGE_MARGIN_PT, PAGE_SIZES, type PageSize } from "./page.ts";
import { toWinAnsi } from "./winansi.ts";

type Pdf = typeof import("@react-pdf/renderer");
type Style = Styles[string];

const INDENT_PT = 16;
const PX_TO_PT = 0.75;
const HEADING_SIZES = { 1: 20, 2: 16, 3: 13.5, 4: 12, 5: 11, 6: 10.5 } as const;
const MUTED = "#666666";
const BORDER = "#CCCCCC";
const NBSP = "\u00A0";
const UNBROKEN_TABLE_ROWS = 12;

interface Emphasis {
  bold?: boolean;
  italic?: boolean;
}

/**
 * Each standard font variant is its own font. Naming it directly keeps nested
 * runs predictable, e.g. a plain link inside a bold heading stays bold.
 */
function fontFamily({ bold, italic }: Emphasis, mono = false): string {
  const variant = bold && italic ? "-BoldOblique" : bold ? "-Bold" : italic ? "-Oblique" : "";
  return `${mono ? "Courier" : "Helvetica"}${variant}`;
}

function runStyle(run: TextRun, base: Emphasis): Style {
  return {
    fontFamily: fontFamily({ bold: run.bold || base.bold, italic: run.italic || base.italic }, run.code),
    ...(run.underline || run.strike || run.href
      ? { textDecoration: run.strike ? "line-through" : "underline" }
      : {}),
    ...(run.code ? { backgroundColor: "#EEEEEE" } : {}),
    ...(run.href ? { color: "#1A4FB5" } : {}),
  };
}

/** A paragraph of runs. Empty paragraphs keep their line, as in the editor. */
function renderRuns(P: Pdf, runs: TextRun[], style: Style = {}, base: Emphasis = {}): ReactElement {
  const paragraph = { ...style, fontFamily: fontFamily(base) };
  if (runs.length === 0) return <P.Text style={paragraph}>{NBSP}</P.Text>;
  return (
    <P.Text style={paragraph}>
      {runs.map((run, i) =>
        run.href ? (
          <P.Link key={i} src={run.href} style={runStyle(run, base)}>{toWinAnsi(run.text)}</P.Link>
        ) : (
          <P.Text key={i} style={runStyle(run, base)}>{toWinAnsi(run.text)}</P.Text>
        ),
      )}
    </P.Text>
  );
}

/** The layout engine drops leading spaces, so indentation becomes no-break spaces. */
function codeText(text: string): string {
  return toWinAnsi(text).replace(/^[ \t]+/gm, (indent) => NBSP.repeat(indent.replace(/\t/g, "    ").length)) || NBSP;
}

/** List row: a fixed-width marker column keeps wrapped lines aligned with the text. */
function renderListRow(P: Pdf, marker: ReactElement, runs: TextRun[], style: Style = {}): ReactElement {
  return (
    <P.View style={{ flexDirection: "row" }}>
      <P.View style={{ width: 18 }}>{marker}</P.View>
      <P.View style={{ flex: 1 }}>{renderRuns(P, runs, style)}</P.View>
    </P.View>
  );
}

function renderTable(P: Pdf, b: Extract<DocBlock, { type: "table" }>): ReactElement {
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
              {renderRuns(P, cells[c] ?? [], {}, { bold: r < b.headerRows })}
            </P.View>
          ))}
        </P.View>
      ))}
    </P.View>
  );
}

function renderImage(P: Pdf, b: Extract<DocBlock, { type: "image" }>, rasters: RasterMap, contentPt: number): ReactElement {
  const raster = rasters.get(b.source);
  const caption = b.caption ? renderRuns(P, [{ text: b.caption }], { fontSize: 9, color: MUTED, marginTop: 4 }, { italic: true }) : null;
  if (!raster) return <P.View>{renderRuns(P, [{ text: imageFallbackText(b.source) }], { color: MUTED })}{caption}</P.View>;
  const width = Math.min(contentPt - b.depth * INDENT_PT, raster.width * PX_TO_PT);
  return (
    <P.View wrap={false}>
      <P.Image src={raster.dataUrl} style={{ width, height: (width * raster.height) / raster.width }} />
      {caption}
    </P.View>
  );
}

function renderBlock(P: Pdf, b: DocBlock, rasters: RasterMap, contentPt: number): ReactElement {
  switch (b.type) {
    case "heading":
      return renderRuns(P, b.runs, { fontSize: HEADING_SIZES[b.level], marginTop: b.level <= 2 ? 10 : 6, marginBottom: 2 }, { bold: true });
    case "paragraph":
      return renderRuns(P, b.runs);
    case "quote":
      return (
        <P.View style={{ borderLeft: "2 solid #BBBBBB", paddingLeft: 8 }}>
          {renderRuns(P, b.runs, { color: "#444444" }, { italic: true })}
        </P.View>
      );
    case "bullet":
      return renderListRow(P, <P.Text>•</P.Text>, b.runs);
    case "number":
      return renderListRow(P, <P.Text>{`${b.number}.`}</P.Text>, b.runs);
    case "check":
      return renderListRow(
        P,
        <P.View style={{ width: 8, height: 8, marginTop: 2.5, border: "1 solid #555555", backgroundColor: b.checked ? "#555555" : undefined }} />,
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
      return renderTable(P, b);
    case "divider":
      return <P.View style={{ borderBottom: `1 solid ${BORDER}`, marginVertical: 6 }} />;
    case "image":
      return renderImage(P, b, rasters, contentPt);
  }
}

export async function entryToPdf(doc: EntryDocument, rasters: RasterMap, pageSize: PageSize): Promise<Blob> {
  const P = await import("@react-pdf/renderer");
  // Hyphenation splits identifiers and table headers ("evi-dence").
  P.Font.registerHyphenationCallback((word) => [word]);
  const contentPt = PAGE_SIZES[pageSize].width - 2 * PAGE_MARGIN_PT;
  const document = (
    <P.Document title={doc.title} creator="WorkLedger" producer="WorkLedger">
      <P.Page size={pageSize} style={{ padding: PAGE_MARGIN_PT, fontFamily: "Helvetica", fontSize: 10.5, lineHeight: 1.45 }}>
        <P.Text style={{ fontSize: 9, color: MUTED, marginBottom: 12 }}>{toWinAnsi(doc.meta)}</P.Text>
        {doc.blocks.map((b, i) => (
          <P.View key={i} style={{ marginLeft: b.depth * INDENT_PT, marginBottom: 4 }}>
            {renderBlock(P, b, rasters, contentPt)}
          </P.View>
        ))}
      </P.Page>
    </P.Document>
  );
  return P.pdf(document).toBlob();
}
