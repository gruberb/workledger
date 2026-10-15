// Lazy entry point for entry downloads, loaded on first use (see App.tsx).
import { BlockNoteEditor, type PartialBlock } from "@blocknote/core";
import type { ExportFormat, WorkLedgerEntry } from "../entries/index.ts";
import { workledgerSchema } from "./components/EditorProvider.tsx";
import { entryToMarkdown, entryFileName } from "./utils/entry-markdown.ts";
import { entryToDocument } from "./utils/entry-document.ts";
import { rasterizeImages } from "./export/images.ts";
import { entryToDocx } from "./export/docx.ts";
import { entryToPdf } from "./export/pdf.tsx";
import { localPageSize } from "./export/page.ts";
import { downloadFile } from "../../utils/download.ts";

const MIME_TYPES: Record<ExportFormat, string> = {
  markdown: "text/markdown",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  pdf: "application/pdf",
};

const EXTENSIONS: Record<ExportFormat, string> = { markdown: "md", docx: "docx", pdf: "pdf" };

async function render(entry: WorkLedgerEntry, format: ExportFormat): Promise<BlobPart> {
  if (format === "markdown") {
    // A headless editor with the app schema; it is never mounted.
    const editor = BlockNoteEditor.create({ schema: workledgerSchema });
    return entryToMarkdown(entry, (blocks: PartialBlock[]) => editor.blocksToMarkdownLossy(blocks as never));
  }
  const doc = entryToDocument(entry);
  const rasters = await rasterizeImages(doc);
  const pageSize = localPageSize(navigator.language);
  return format === "docx" ? entryToDocx(doc, rasters, pageSize) : entryToPdf(doc, rasters, pageSize);
}

/** Rejects if the export fails, e.g. when an export library can't load offline. */
export async function downloadEntry(entry: WorkLedgerEntry, format: ExportFormat): Promise<void> {
  downloadFile(entryFileName(entry, EXTENSIONS[format]), await render(entry, format), MIME_TYPES[format]);
}
