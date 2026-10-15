// Format-neutral view of an entry for the PDF and Word exporters. BlockNote's
// tree is flattened into blocks with a nesting depth, list numbers are resolved
// and links are checked here, so each renderer only maps a small, closed set of
// block types.
import { extractTitle, SIGNIFIER_CONFIG, type WorkLedgerEntry } from "../../entries/index.ts";

export interface TextRun {
  text: string;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  strike?: boolean;
  code?: boolean;
  /** Only http, https and mailto: entries arrive through sync and import. */
  href?: string;
}

export type ImageSource =
  | { kind: "url"; url: string }
  | { kind: "drawing"; previewSvg: string; previewKey: string; drawingData: string };

export type DocBlock = { depth: number } & (
  | { type: "heading"; level: 1 | 2 | 3 | 4 | 5 | 6; runs: TextRun[] }
  | { type: "paragraph"; runs: TextRun[] }
  | { type: "quote"; runs: TextRun[] }
  | { type: "bullet"; runs: TextRun[] }
  /** `list` is shared by consecutive siblings, so renderers can restart numbering per list. */
  | { type: "number"; number: number; list: number; runs: TextRun[] }
  | { type: "check"; checked: boolean; runs: TextRun[] }
  | { type: "code"; text: string }
  | { type: "table"; rows: TextRun[][][]; headerRows: number }
  | { type: "image"; source: ImageSource; caption: string }
  | { type: "divider" }
);

export interface EntryDocument {
  title: string;
  /** Date, signifier and tags, shown above the body. */
  meta: string;
  blocks: DocBlock[];
}

interface LooseBlock {
  type?: string;
  props?: Record<string, unknown>;
  content?: unknown;
  children?: LooseBlock[];
}

interface LooseInline {
  type?: string;
  text?: string;
  href?: string;
  styles?: Record<string, unknown>;
  content?: unknown;
  props?: { displayText?: string };
}

const SAFE_LINK = /^(https?:|mailto:)/i;

function safeHref(href: unknown): string | undefined {
  return typeof href === "string" && SAFE_LINK.test(href.trim()) ? href.trim() : undefined;
}

function styledRun(text: string, styles: Record<string, unknown> = {}, href?: string): TextRun {
  const run: TextRun = { text };
  if (styles.bold) run.bold = true;
  if (styles.italic) run.italic = true;
  if (styles.underline) run.underline = true;
  if (styles.strike) run.strike = true;
  if (styles.code) run.code = true;
  if (href) run.href = href;
  return run;
}

export function toRuns(content: unknown): TextRun[] {
  if (typeof content === "string") return content ? [{ text: content }] : [];
  if (!Array.isArray(content)) return [];
  const runs: TextRun[] = [];
  for (const item of content as (LooseInline | string)[]) {
    if (typeof item === "string") {
      if (item) runs.push({ text: item });
    } else if (item?.type === "text" && item.text) {
      runs.push(styledRun(item.text, item.styles));
    } else if (item?.type === "link") {
      const href = safeHref(item.href);
      for (const inner of toRuns(item.content)) runs.push(href ? { ...inner, href } : inner);
    } else if (item?.type === "entryLink") {
      // Other entries don't exist outside the app, so the link keeps only its title.
      runs.push({ text: item.props?.displayText || "Untitled entry" });
    }
  }
  return runs;
}

function tableRows(content: unknown): { rows: TextRun[][][]; headerRows: number } {
  const table = (content ?? {}) as { rows?: { cells?: unknown[] }[]; headerRows?: number };
  const rows = (table.rows ?? []).map((row) =>
    (row.cells ?? []).map((cell) =>
      cell && typeof cell === "object" && !Array.isArray(cell) ? toRuns((cell as { content?: unknown }).content) : toRuns(cell),
    ),
  );
  return { rows, headerRows: typeof table.headerRows === "number" ? table.headerRows : 0 };
}

function headingLevel(value: unknown): 1 | 2 | 3 | 4 | 5 | 6 {
  const level = Number(value);
  return level >= 1 && level <= 6 ? (level as 1 | 2 | 3 | 4 | 5 | 6) : 1;
}

function str(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function flatten(blocks: LooseBlock[], depth: number, out: DocBlock[], nextList: () => number) {
  let list = -1;
  let number = 0;
  for (const block of blocks) {
    const props = block.props ?? {};
    if (block.type === "numberedListItem") {
      if (list < 0) {
        list = nextList();
        const start = Number(props.start);
        number = Number.isInteger(start) && start > 0 ? start : 1;
      } else {
        number += 1;
      }
      out.push({ type: "number", depth, number, list, runs: toRuns(block.content) });
    } else {
      list = -1;
      const mapped = mapBlock(block, props, depth);
      if (mapped) out.push(mapped);
    }
    if (block.children?.length) flatten(block.children, depth + 1, out, nextList);
  }
}

function mapBlock(block: LooseBlock, props: Record<string, unknown>, depth: number): DocBlock | null {
  const runs = () => toRuns(block.content);
  switch (block.type) {
    case "heading":
      return { type: "heading", depth, level: headingLevel(props.level), runs: runs() };
    case "quote":
      return { type: "quote", depth, runs: runs() };
    // Toggle lists export expanded, since paper can't collapse.
    case "bulletListItem":
    case "toggleListItem":
      return { type: "bullet", depth, runs: runs() };
    case "checkListItem":
      return { type: "check", depth, checked: props.checked === true, runs: runs() };
    case "codeBlock":
      return { type: "code", depth, text: toRuns(block.content).map((r) => r.text).join("") };
    case "table":
      return { type: "table", depth, ...tableRows(block.content) };
    case "divider":
      return { type: "divider", depth };
    case "image": {
      const url = str(props.url);
      if (!url) return null;
      return { type: "image", depth, source: { kind: "url", url }, caption: str(props.caption) };
    }
    case "excalidraw": {
      const source = { kind: "drawing" as const, previewSvg: str(props.previewSvg), previewKey: str(props.previewKey), drawingData: str(props.drawingData) };
      if (!source.previewSvg && !source.drawingData) return null;
      return { type: "image", depth, source, caption: "" };
    }
    // Media can't play on paper; keep a link so nothing silently disappears.
    case "file":
    case "video":
    case "audio": {
      const href = safeHref(props.url);
      const label = str(props.name) || str(props.url) || block.type;
      return { type: "paragraph", depth, runs: [{ text: `${block.type[0].toUpperCase()}${block.type.slice(1)}: ` }, { text: label, href }] };
    }
    default:
      return { type: "paragraph", depth, runs: runs() };
  }
}

export function entryToDocument(entry: WorkLedgerEntry): EntryDocument {
  let lists = 0;
  const blocks: DocBlock[] = [];
  flatten(entry.blocks as LooseBlock[], 0, blocks, () => lists++);
  const meta = [
    entry.dayKey,
    ...(entry.signifier ? [SIGNIFIER_CONFIG[entry.signifier]?.label ?? entry.signifier] : []),
    ...entry.tags.map((t) => `#${t}`),
  ].join("  ·  ");
  return { title: extractTitle(entry), meta, blocks };
}
