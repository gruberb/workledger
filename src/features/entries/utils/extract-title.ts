import type { WorkLedgerEntry } from "../types/entry.ts";

interface InlineLike {
  type?: string;
  text?: string;
  props?: { displayText?: string };
}

/** Plain text of one block's inline content, including wiki-link labels. */
function blockText(block: unknown): string {
  const content = (block as { content?: unknown }).content;
  if (!Array.isArray(content)) return "";
  return (content as InlineLike[])
    .map((c) => (c.type === "text" ? c.text ?? "" : c.type === "entryLink" ? c.props?.displayText ?? "" : ""))
    .join("")
    .trim();
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
