import type { WorkLedgerEntry } from "../types/entry.ts";

/**
 * Every tag in use: the stored tags (collected by the last full read, so tags
 * outside the loaded window count) plus tags of the loaded entries (edits since).
 */
export function collectKnownTags(storedTags: string[], entriesByDay: Map<string, WorkLedgerEntry[]>): string[] {
  const tags = new Set(storedTags);
  for (const entries of entriesByDay.values()) {
    for (const entry of entries) {
      for (const tag of entry.tags ?? []) tags.add(tag);
    }
  }
  return [...tags];
}

/**
 * Tags to offer while typing: prefix matches first, then other substring
 * matches, each group alphabetical. An empty query offers everything.
 */
export function suggestTags(known: string[], query: string, exclude: string[], limit: number): string[] {
  const q = query.trim().toLowerCase();
  const taken = new Set(exclude);
  const prefix: string[] = [];
  const inner: string[] = [];
  for (const tag of known) {
    if (taken.has(tag)) continue;
    const lower = tag.toLowerCase();
    if (lower.startsWith(q)) prefix.push(tag);
    else if (lower.includes(q)) inner.push(tag);
  }
  const alphabetical = (a: string, b: string) => a.localeCompare(b);
  return [...prefix.sort(alphabetical), ...inner.sort(alphabetical)].slice(0, limit);
}
