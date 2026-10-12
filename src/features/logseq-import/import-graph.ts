import { BlockNoteEditor, type PartialBlock } from "@blocknote/core";
import { saveImportedEntries } from "../entries/index.ts";
import { workledgerSchema } from "../editor/index.ts";
import { convertGraph, type GraphFile } from "./utils/logseq-graph.ts";

export interface LogseqImportResult {
  imported: number;
  /** Already present and not older than the graph's version. */
  unchanged: number;
  skippedFiles: number;
  skippedAssets: number;
}

/**
 * Id derived from the file's path in the graph, formatted as a UUID like every
 * other entry id. Re-importing the same graph then updates entries in place.
 */
async function stableId(key: string): Promise<string> {
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`logseq:${key}`)));
  const hex = [...digest.slice(0, 16)].map((b) => b.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
}

/** Loaded on demand (BlockNote parsing is only needed while importing). */
export async function importLogseqGraph(fileList: FileList): Promise<LogseqImportResult> {
  const markdownFiles = [...fileList].filter((f) => f.name.toLowerCase().endsWith(".md"));
  if (markdownFiles.length === 0) throw new Error("No Logseq markdown files found in this folder");

  const files: GraphFile[] = await Promise.all(
    markdownFiles.map(async (f) => ({
      relativePath: f.webkitRelativePath || f.name,
      text: await f.text(),
      lastModified: f.lastModified,
    })),
  );

  // A headless editor with the app schema parses markdown into the same block
  // types the notebook uses; it is never mounted.
  const editor = BlockNoteEditor.create({ schema: workledgerSchema });
  const conversion = await convertGraph(files, {
    parseMarkdown: (markdown) => editor.tryParseMarkdownToBlocks(markdown) as PartialBlock[],
    makeId: stableId,
  });
  if (conversion.entries.length === 0) {
    throw new Error("No journals or pages found. Pick the graph folder that contains journals/ and pages/");
  }

  const saved = await saveImportedEntries(conversion.entries);
  return {
    imported: saved.imported,
    unchanged: saved.skipped,
    skippedFiles: conversion.skippedFiles,
    skippedAssets: conversion.skippedAssets,
  };
}
