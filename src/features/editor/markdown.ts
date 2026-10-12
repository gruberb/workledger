// Lazy entry point for Markdown export, loaded on first download (see App.tsx).
import { BlockNoteEditor, type PartialBlock } from "@blocknote/core";
import type { WorkLedgerEntry } from "../entries/index.ts";
import { workledgerSchema } from "./components/EditorProvider.tsx";
import { entryToMarkdown, markdownFileName } from "./utils/entry-markdown.ts";
import { downloadFile } from "../../utils/download.ts";

export function downloadEntryMarkdown(entry: WorkLedgerEntry): void {
  // A headless editor with the app schema; it is never mounted.
  const editor = BlockNoteEditor.create({ schema: workledgerSchema });
  const markdown = entryToMarkdown(entry, (blocks: PartialBlock[]) => editor.blocksToMarkdownLossy(blocks as never));
  downloadFile(markdownFileName(entry), markdown, "text/markdown");
}
