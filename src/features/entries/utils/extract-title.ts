import type { WorkLedgerEntry } from "../types/entry.ts";

/**
 * Extract a short title from an entry's blocks:
 * 1. First heading block's text
 * 2. Otherwise first non-empty text content, truncated
 */
export function extractTitle(entry: WorkLedgerEntry): string {
  for (const block of entry.blocks) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const b = block as any;
    if (b.type === "heading" && Array.isArray(b.content)) {
      const text = b.content
        .filter((c: { type: string }) => c.type === "text")
        .map((c: { text: string }) => c.text)
        .join("");
      if (text.trim()) return text.trim();
    }
  }
  // No heading — use first non-empty text
  for (const block of entry.blocks) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const b = block as any;
    if (Array.isArray(b.content)) {
      const text = b.content
        .filter((c: { type: string }) => c.type === "text")
        .map((c: { text: string }) => c.text)
        .join("");
      if (text.trim()) {
        const trimmed = text.trim();
        if (trimmed.length <= 50) return trimmed;
        return trimmed.slice(0, 47) + "...";
      }
    }
  }
  return "Untitled entry";
}
