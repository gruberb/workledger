import type { WorkLedgerEntry } from "../types/entry.ts";

interface InlineLike {
  type?: string;
  text?: string;
  props?: { displayText?: string };
  content?: InlineLike[];
}

function inlineText(c: InlineLike): string {
  if (c.type === "text") return c.text ?? "";
  if (c.type === "entryLink") return c.props?.displayText ?? "";
  if (c.type === "link" && Array.isArray(c.content)) return c.content.map(inlineText).join("");
  return "";
}

/** Plain text of one block's inline content, including link and wiki-link labels. */
export function blockText(block: unknown): string {
  const content = (block as { content?: unknown }).content;
  // Template blocks are PartialBlocks, which may hold plain strings until the editor saves them.
  if (typeof content === "string") return content.trim();
  if (!Array.isArray(content)) return "";
  return (content as InlineLike[]).map(inlineText).join("").trim();
}

function truncate(text: string, max: number): string {
  return text.length <= max ? text : text.slice(0, max - 3) + "...";
}

/**
 * Extract a short title from an entry's blocks:
 * 1. First heading block's text
 * 2. Otherwise first non-empty text content, truncated
 */
export function extractTitle(entry: WorkLedgerEntry): string {
  for (const block of entry.blocks) {
    if (block.type !== "heading") continue;
    const text = blockText(block);
    if (text) return text;
  }
  for (const block of entry.blocks) {
    const text = blockText(block);
    if (text) return truncate(text, 50);
  }
  return "Untitled entry";
}

/**
 * Extract a short preview from an entry's blocks:
 * First non-heading paragraph text, truncated to 80 chars.
 */
export function extractPreview(entry: WorkLedgerEntry): string | null {
  for (const block of entry.blocks) {
    if (block.type === "heading") continue;
    const text = blockText(block);
    if (text) return truncate(text, 80);
  }
  return null;
}
