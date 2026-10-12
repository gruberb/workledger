import type { PartialBlock } from "@blocknote/core";
import { format } from "date-fns";
import type { WorkLedgerEntry } from "../../entries/index.ts";
import {
  PAGE_LINK_PREFIX,
  collectBlockRefs,
  convertLogseqMarkdown,
  normalizeTag,
  parsePropertyList,
  type BlockRefs,
} from "./logseq-markdown.ts";

export interface GraphFile {
  /** Path from the picked folder, e.g. `my-graph/journals/2024_06_15.md`. */
  relativePath: string;
  text: string;
  lastModified: number;
}

export interface ConvertGraphOptions {
  parseMarkdown: (markdown: string) => PartialBlock[];
  /** Must be deterministic so re-importing a graph updates entries instead of duplicating them. */
  makeId: (key: string) => Promise<string>;
  /** Fallback timestamp for files that report no modification time. */
  now?: number;
}

export interface GraphConversion {
  entries: WorkLedgerEntry[];
  /** Markdown files outside journals/ and pages/, or with no content. */
  skippedFiles: number;
  skippedAssets: number;
}

interface ClassifiedFile {
  file: GraphFile;
  kind: "journal" | "page";
  /** Stable key: graph folder plus path inside it. */
  key: string;
  title: string;
  journalDate?: Date;
}

const JOURNAL_FILE = /^(\d{4})[_-](\d{2})[_-](\d{2})\.md$/i;

/** Logseq's default journal page title format, used when pages link to a day. */
const JOURNAL_TITLE_FORMAT = "MMM do, yyyy";

/** Page file names encode `/` (namespaces) as `___`, or URL-encode it in older graphs. */
export function pageTitleFromFileName(fileName: string): string {
  const base = fileName.replace(/\.md$/i, "");
  let decoded = base;
  if (base.includes("%")) {
    try {
      decoded = decodeURIComponent(base);
    } catch {
      // Not valid percent-encoding; keep the name as written.
    }
  }
  return decoded.replace(/___/g, "/");
}

export function parseJournalDate(fileName: string): Date | undefined {
  const m = fileName.match(JOURNAL_FILE);
  if (!m) return undefined;
  const date = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 12);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

function classify(file: GraphFile): ClassifiedFile | null {
  const segments = file.relativePath.split("/");
  if (segments.length < 2 || !segments[segments.length - 1].toLowerCase().endsWith(".md")) return null;
  // logseq/bak and logseq/version-files hold backups of the same pages.
  if (segments.some((s) => s === "logseq")) return null;
  const folder = segments[segments.length - 2];
  const fileName = segments[segments.length - 1];
  const key = file.relativePath;
  if (folder === "journals") {
    const journalDate = parseJournalDate(fileName);
    if (!journalDate) return null;
    return { file, kind: "journal", key, title: format(journalDate, JOURNAL_TITLE_FORMAT), journalDate };
  }
  if (folder === "pages") {
    return { file, kind: "page", key, title: pageTitleFromFileName(fileName) };
  }
  return null;
}

type InlineItem = Record<string, unknown>;

function inlineText(items: unknown): string {
  if (!Array.isArray(items)) return "";
  return items.map((i) => (typeof i?.text === "string" ? i.text : inlineText(i?.content))).join("");
}

/** Replaces placeholder page links with entry links, or with their text when the page is not in the graph. */
function linkInline(items: InlineItem[], resolve: (page: string) => string | undefined): InlineItem[] {
  return items.flatMap((item): InlineItem[] => {
    const href = item.type === "link" ? item.href : undefined;
    if (typeof href !== "string" || !href.startsWith(PAGE_LINK_PREFIX)) return [item];
    const page = decodeURIComponent(href.slice(PAGE_LINK_PREFIX.length));
    const text = inlineText(item.content) || page;
    const entryId = resolve(page);
    if (entryId) return [{ type: "entryLink", props: { entryId, displayText: text } }];
    return [{ type: "text", text, styles: {} }];
  });
}

function linkBlocks(blocks: PartialBlock[], resolve: (page: string) => string | undefined): PartialBlock[] {
  return blocks.map((block) => {
    const next = { ...block } as Record<string, unknown>;
    if (Array.isArray(next.content)) {
      next.content = linkInline(next.content as InlineItem[], resolve);
    } else if (next.content && typeof next.content === "object" && "rows" in next.content) {
      const table = next.content as { rows: { cells: unknown[] }[] };
      next.content = {
        ...table,
        rows: table.rows.map((row) => ({
          ...row,
          cells: row.cells.map((cell) => {
            if (Array.isArray(cell)) return linkInline(cell as InlineItem[], resolve);
            const c = cell as { content?: InlineItem[] };
            return Array.isArray(c?.content) ? { ...c, content: linkInline(c.content, resolve) } : cell;
          }),
        })),
      };
    }
    if (Array.isArray(next.children)) next.children = linkBlocks(next.children as PartialBlock[], resolve);
    return next as PartialBlock;
  });
}

function isEmpty(blocks: PartialBlock[]): boolean {
  return blocks.every((b) => {
    const children = (b.children ?? []) as PartialBlock[];
    const content = b.content;
    const hasContent = Array.isArray(content) ? inlineText(content).trim() !== "" || content.some((i) => typeof i !== "string" && i.type !== "text") : !!content;
    const textBlock = ["paragraph", "bulletListItem", "numberedListItem", undefined].includes(b.type as string);
    return textBlock && !hasContent && isEmpty(children);
  });
}

/**
 * Turns the files of a Logseq graph into WorkLedger entries. Journals land on
 * their own date; pages land on their file's last modified day and start with
 * their title as a heading. Links between files become entry links.
 */
export async function convertGraph(files: GraphFile[], options: ConvertGraphOptions): Promise<GraphConversion> {
  const now = options.now ?? Date.now();
  const classified: ClassifiedFile[] = [];
  let skippedFiles = 0;
  for (const file of files) {
    const c = classify(file);
    if (c) classified.push(c);
    else if (file.relativePath.toLowerCase().endsWith(".md")) skippedFiles++;
  }

  const refs: BlockRefs = new Map();
  for (const c of classified) collectBlockRefs(c.file.text, refs);

  const converted = classified.map((c) => ({ c, page: convertLogseqMarkdown(c.file.text, refs) }));

  // Every name a link can use: titles (Logseq matches case-insensitively),
  // title:: overrides and alias:: names.
  const ids = await Promise.all(converted.map(({ c }) => options.makeId(c.key)));
  const byName = new Map<string, string>();
  converted.forEach(({ c, page }, i) => {
    const names = [c.title, page.properties.title, ...parsePropertyList(page.properties.alias ?? "")];
    for (const name of names) if (name) byName.set(name.trim().toLowerCase(), ids[i]);
  });
  const resolve = (page: string) => byName.get(page.trim().toLowerCase());

  const entries: WorkLedgerEntry[] = [];
  let skippedAssets = 0;
  converted.forEach(({ c, page }, i) => {
    skippedAssets += page.skippedAssets;
    const body = linkBlocks(options.parseMarkdown(page.markdown), resolve);
    if (isEmpty(body)) {
      skippedFiles++;
      return;
    }
    const modified = c.file.lastModified > 0 ? c.file.lastModified : now;
    const title = page.properties.title || c.title;
    const blocks: PartialBlock[] = c.kind === "page"
      ? [{ type: "heading", props: { level: 2 }, content: title } as PartialBlock, ...body]
      : body;
    const day = c.journalDate ?? new Date(modified);
    entries.push({
      id: ids[i],
      dayKey: format(day, "yyyy-MM-dd"),
      createdAt: c.journalDate ? c.journalDate.getTime() : modified,
      updatedAt: modified,
      blocks,
      isArchived: false,
      isPinned: false,
      tags: [...new Set(page.tags.map(normalizeTag))].filter(Boolean),
    });
  });

  return { entries, skippedFiles, skippedAssets };
}
