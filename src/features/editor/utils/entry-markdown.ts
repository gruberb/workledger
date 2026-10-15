import type { PartialBlock } from "@blocknote/core";
import { extractTitle, type WorkLedgerEntry } from "../../entries/index.ts";

interface LooseBlock {
  type?: string;
  content?: unknown;
  children?: LooseBlock[];
  [key: string]: unknown;
}

interface LooseInline {
  type?: string;
  props?: { displayText?: string };
}

/** BlockNote's export has no rule for entry links and would drop them; keep them as wiki-links. */
function rewriteInline(content: unknown): unknown {
  if (!Array.isArray(content)) return content;
  return (content as LooseInline[]).map((c) =>
    c?.type === "entryLink" ? { type: "text", text: `[[${c.props?.displayText || "Untitled entry"}]]`, styles: {} } : c,
  );
}

function rewriteTable(content: { rows?: { cells?: unknown[] }[] }) {
  return {
    ...content,
    rows: (content.rows ?? []).map((row) => ({
      ...row,
      cells: (row.cells ?? []).map((cell) =>
        Array.isArray(cell) ? rewriteInline(cell) : { ...(cell as object), content: rewriteInline((cell as { content?: unknown })?.content) },
      ),
    })),
  };
}

function prepareBlock(block: LooseBlock): LooseBlock {
  // Markdown can't carry the drawing, and a model reading the file can't see SVG either.
  if (block.type === "excalidraw") return { type: "paragraph", content: "[Drawing]" };
  const next: LooseBlock = { ...block };
  if (Array.isArray(block.content)) next.content = rewriteInline(block.content);
  else if (block.type === "table" && block.content) next.content = rewriteTable(block.content as { rows?: { cells?: unknown[] }[] });
  if (block.children?.length) next.children = block.children.map(prepareBlock);
  return next;
}

/** Replaces content Markdown can't express, so the lossy export keeps its meaning. */
export function prepareBlocksForMarkdown(blocks: PartialBlock[]): PartialBlock[] {
  return (blocks as LooseBlock[]).map(prepareBlock) as PartialBlock[];
}

/** JSON strings are valid YAML double-quoted scalars, so titles with colons or quotes stay intact. */
function frontMatter(entry: WorkLedgerEntry): string {
  const lines = [
    `title: ${JSON.stringify(extractTitle(entry))}`,
    `date: ${entry.dayKey}`,
    ...(entry.tags.length > 0 ? [`tags: ${JSON.stringify(entry.tags)}`] : []),
    ...(entry.signifier ? [`signifier: ${entry.signifier}`] : []),
    `id: ${entry.id}`,
  ];
  return `---\n${lines.join("\n")}\n---\n\n`;
}

/** One entry as Markdown with YAML front matter. `toMarkdown` is BlockNote's serializer, injected for testing. */
export function entryToMarkdown(entry: WorkLedgerEntry, toMarkdown: (blocks: PartialBlock[]) => string): string {
  return frontMatter(entry) + toMarkdown(prepareBlocksForMarkdown(entry.blocks));
}

export function entryFileName(entry: WorkLedgerEntry, extension: string): string {
  const slug = extractTitle(entry)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60);
  return `${entry.dayKey}${slug ? `-${slug}` : ""}.${extension}`;
}
