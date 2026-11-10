import type { PartialBlock } from "@blocknote/core";
import type { EntrySignifier, WorkLedgerEntry } from "../types/entry.ts";
import { blockText, extractTitle } from "./extract-title.ts";

/** An unchecked checklist item. `key` finds it again in the entry's blocks. */
export interface OpenTask {
  key: string;
  text: string;
}

/** One note with open items: its unchecked checklist items, and whether it is an open question. */
export interface OpenLoopGroup {
  entry: WorkLedgerEntry;
  title: string;
  ageDays: number;
  tasks: OpenTask[];
  isQuestion: boolean;
}

export interface OpenLoopBucket {
  label: string;
  groups: OpenLoopGroup[];
}

export interface AgeBucketSpec {
  label: string;
  /** Inclusive upper bound in days since the note's day. */
  maxDays: number;
}

export const DEFAULT_AGE_BUCKETS: AgeBucketSpec[] = [
  { label: "Last 7 days", maxDays: 6 },
  { label: "Last 30 days", maxDays: 30 },
  { label: "Older", maxDays: Infinity },
];

export interface OpenLoopFilter {
  /** Every tag must be on the entry (same as the sidebar filter). */
  tags: string[];
  /** The entry must have one of these, when any are given. */
  signifiers: EntrySignifier[];
}

export type CloseMode = "done" | "drop";

interface InlineRun {
  type?: string;
  text?: string;
  styles?: Record<string, unknown>;
  content?: InlineRun[];
}

interface BlockLike {
  id?: string;
  type?: string;
  props?: Record<string, unknown>;
  content?: unknown;
  children?: BlockLike[];
}

/**
 * Template blocks have no id until the editor first saves the entry, so fall
 * back to the block's position. `closeTask` re-checks that the block at that
 * position is still an open item before touching it.
 */
function taskKey(block: BlockLike, path: number[]): string {
  return block.id ?? `@${path.join(".")}`;
}

function textRuns(content: unknown): InlineRun[] {
  if (typeof content === "string") return [{ type: "text", text: content }];
  if (!Array.isArray(content)) return [];
  return (content as InlineRun[]).flatMap((c) => (c.type === "link" ? textRuns(c.content) : c.type === "text" ? [c] : []));
}

/** Striking an item through by hand counts as dropping it, same as the Drop action. */
function isStruckThrough(block: BlockLike): boolean {
  const runs = textRuns(block.content).filter((r) => (r.text ?? "").trim() !== "");
  return runs.length > 0 && runs.every((r) => r.styles?.strike === true);
}

function isOpenTask(block: BlockLike): boolean {
  return block.type === "checkListItem" && block.props?.checked !== true && blockText(block) !== "" && !isStruckThrough(block);
}

/** Unchecked checklist items, nested ones included, in document order. */
export function openTasks(blocks: PartialBlock[]): OpenTask[] {
  const tasks: OpenTask[] = [];
  const walk = (list: BlockLike[], parent: number[]) => {
    list.forEach((block, i) => {
      const path = [...parent, i];
      if (isOpenTask(block)) tasks.push({ key: taskKey(block, path), text: blockText(block) });
      if (Array.isArray(block.children)) walk(block.children, path);
    });
  };
  walk(blocks as BlockLike[], []);
  return tasks;
}

function strike(content: unknown): unknown {
  if (typeof content === "string") return [{ type: "text", text: content, styles: { strike: true } }];
  if (!Array.isArray(content)) return content;
  return (content as InlineRun[]).map((c) => {
    if (c.type === "text") return { ...c, styles: { ...c.styles, strike: true } };
    if (c.type === "link") return { ...c, content: strike(c.content) };
    return c;
  });
}

/**
 * Checks the open item `key`; `drop` also strikes its text through, so the note
 * shows it was abandoned, not finished. Returns null when the item is gone or
 * no longer open (edited elsewhere since it was listed), so nothing is written.
 */
export function closeTask(blocks: PartialBlock[], key: string, mode: CloseMode): PartialBlock[] | null {
  let found = false;
  const map = (list: BlockLike[], parent: number[]): BlockLike[] =>
    list.map((block, i) => {
      const path = [...parent, i];
      if (!found && taskKey(block, path) === key && isOpenTask(block)) {
        found = true;
        return {
          ...block,
          props: { ...block.props, checked: true },
          content: mode === "drop" ? strike(block.content) : block.content,
        };
      }
      if (!found && Array.isArray(block.children) && block.children.length > 0) {
        const children = map(block.children, path);
        if (found) return { ...block, children };
      }
      return block;
    });
  const next = map(blocks as BlockLike[], []);
  return found ? (next as PartialBlock[]) : null;
}

/** Whole days from `dayKey` to `todayKey` (both local YYYY-MM-DD), DST-safe. */
export function daysBetween(dayKey: string, todayKey: string): number {
  const utc = (key: string) => {
    const [y, m, d] = key.split("-").map(Number);
    return Date.UTC(y, m - 1, d);
  };
  return Math.max(0, Math.round((utc(todayKey) - utc(dayKey)) / 86_400_000));
}

function matches(entry: WorkLedgerEntry, filter: OpenLoopFilter): boolean {
  if (!filter.tags.every((t) => entry.tags.includes(t))) return false;
  return filter.signifiers.length === 0 || (!!entry.signifier && filter.signifiers.includes(entry.signifier));
}

/**
 * Active notes with unchecked checklist items or the `question` signifier,
 * newest first, split into age buckets. Empty buckets are left out.
 */
export function collectOpenLoops(
  entries: WorkLedgerEntry[],
  todayKey: string,
  filter: OpenLoopFilter,
  buckets: AgeBucketSpec[] = DEFAULT_AGE_BUCKETS,
): OpenLoopBucket[] {
  const groups: OpenLoopGroup[] = [];
  for (const entry of entries) {
    if (entry.isArchived || !matches(entry, filter)) continue;
    const tasks = openTasks(entry.blocks);
    const isQuestion = entry.signifier === "question";
    if (tasks.length === 0 && !isQuestion) continue;
    groups.push({ entry, title: extractTitle(entry), ageDays: daysBetween(entry.dayKey, todayKey), tasks, isQuestion });
  }
  groups.sort((a, b) => b.entry.createdAt - a.entry.createdAt);

  const result = buckets.map((b) => ({ label: b.label, groups: [] as OpenLoopGroup[] }));
  for (const group of groups) {
    const index = buckets.findIndex((b) => group.ageDays <= b.maxDays);
    result[index === -1 ? result.length - 1 : index].groups.push(group);
  }
  return result.filter((b) => b.groups.length > 0);
}
