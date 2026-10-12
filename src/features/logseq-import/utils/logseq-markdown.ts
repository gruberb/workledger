/**
 * Converts Logseq's file-based markdown dialect into standard markdown that
 * BlockNote's parser understands. Pure string work, so it is testable without
 * a DOM.
 *
 * Logseq features and how they map:
 * - outline bullets               -> nested list items (unchanged)
 * - `key:: value` properties      -> dropped; `tags`, `alias`, `title` harvested
 * - TODO/DONE/... markers         -> GFM task list items
 * - [[Page]], [label]([[Page]])   -> placeholder links, resolved to entry links after parsing
 * - #tag, #[[multi word]]         -> entry tags (text kept)
 * - ((block-uuid)) and embeds     -> the referenced block's text, when known
 * - other {{macros}}              -> inline code, so nothing silently disappears
 * - local asset images            -> a text note (assets are not imported)
 */

/**
 * Page links survive BlockNote's markdown parser as ordinary https links: a
 * custom scheme could be dropped by link validation. `.invalid` is reserved
 * (RFC 2606), so a stray placeholder never points anywhere real.
 */
export const PAGE_LINK_PREFIX = "https://logseq.invalid/page/";

const PROPERTY_LINE = /^([A-Za-z][\w-]*)::\s*(.*)$/;
const BULLET = /^(\s*)- ?(.*)$/;
const OPEN_TASK = /^(?:TODO|DOING|NOW|LATER|WAIT|WAITING|IN-PROGRESS)\s+/;
const DONE_TASK = /^DONE\s+/;
const CANCELED_TASK = /^CANCEL(?:L)?ED\s+/;
const PRIORITY = /\[#[ABC]\]\s*/g;
const UUID = "[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}";
const BLOCK_REF = new RegExp(`\\(\\((${UUID})\\)\\)`, "g");
const EMBED_REF = new RegExp(`\\{\\{embed \\(\\((${UUID})\\)\\)\\}\\}`, "g");
const EMBED_PAGE = /\{\{embed \[\[([^\]]+)\]\]\}\}/g;
const MACRO = /\{\{[^}]*\}\}/g;
const IMAGE = /!\[([^\]]*)\]\(([^)\s]+)[^)]*\)/g;
const ALIASED_PAGE_LINK = /\[([^\]]+)\]\(\[\[([^\]]+)\]\]\)/g;
const BRACKET_TAG = /#\[\[([^\]]+)\]\]/g;
const PAGE_LINK = /\[\[([^\]]+)\]\]/g;
const HASH_TAG = /(^|\s)#([^\s#.,;:!?()[\]"'`]+)/g;

/** Block uuid -> the block's first line, for resolving ((refs)) and embeds. */
export type BlockRefs = Map<string, string>;

export interface ConvertedPage {
  markdown: string;
  /** Page-level properties (keys lowercased). */
  properties: Record<string, string>;
  tags: string[];
  /** Local asset images replaced by a note. */
  skippedAssets: number;
}

export function normalizeTag(tag: string): string {
  return tag.trim().toLowerCase();
}

/** Splits a property value like `[[a]], b, #c` into `["a", "b", "c"]`. */
export function parsePropertyList(value: string): string[] {
  return value
    .split(",")
    .map((part) => part.trim().replace(/^#/, "").replace(/^\[\[(.*)\]\]$/, "$1").trim())
    .filter(Boolean);
}

function pageLink(label: string, page: string): string {
  return `[${label.replace(/[[\]]/g, "")}](${PAGE_LINK_PREFIX}${encodeURIComponent(page.trim())})`;
}

/** Logseq indents with tabs; CommonMark list nesting is reliable with spaces. */
function expandIndent(line: string): string {
  return line.replace(/^\t+/, (tabs) => "  ".repeat(tabs.length));
}

/** Plain text of a block's first line, used as the replacement for refs to it. */
function refText(content: string): string {
  return content
    .replace(OPEN_TASK, "")
    .replace(DONE_TASK, "")
    .replace(CANCELED_TASK, "")
    .replace(PRIORITY, "")
    .replace(PAGE_LINK, "$1")
    .trim();
}

/** First pass over a file: remember `id::` properties so refs from any file can resolve. */
export function collectBlockRefs(text: string, refs: BlockRefs): void {
  let lastBullet = "";
  for (const raw of text.split(/\r?\n/)) {
    const line = expandIndent(raw);
    const bullet = line.match(BULLET);
    if (bullet && !PROPERTY_LINE.test(bullet[2])) {
      lastBullet = bullet[2];
      continue;
    }
    const prop = line.trim().match(PROPERTY_LINE);
    if (prop && prop[1].toLowerCase() === "id" && lastBullet) {
      refs.set(prop[2].trim().toLowerCase(), refText(lastBullet));
    }
  }
}

function convertInline(text: string, refs: BlockRefs, tags: Set<string>, counts: { assets: number }): string {
  const resolveRef = (_: string, uuid: string) => refs.get(uuid.toLowerCase()) ?? "(block reference)";
  return text
    .replace(EMBED_PAGE, (_, page: string) => pageLink(page, page))
    .replace(EMBED_REF, resolveRef)
    .replace(BLOCK_REF, resolveRef)
    .replace(MACRO, (macro) => `\`${macro}\``)
    .replace(IMAGE, (match, alt: string, url: string) => {
      if (/^https?:\/\//i.test(url)) return match;
      counts.assets++;
      const name = url.split("/").pop() ?? url;
      return `*[image not imported: ${alt || name}]*`;
    })
    // Plain hashtags first: rewriting #[[on call]] to "#on call" below would
    // otherwise be picked up again as the tag "on".
    .replace(HASH_TAG, (match, _lead: string, tag: string) => {
      tags.add(normalizeTag(tag));
      return match;
    })
    .replace(ALIASED_PAGE_LINK, (_, label: string, page: string) => pageLink(label, page))
    .replace(BRACKET_TAG, (_, tag: string) => {
      tags.add(normalizeTag(tag));
      return `#${tag}`;
    })
    .replace(PAGE_LINK, (_, page: string) => pageLink(page, page));
}

function convertTaskMarker(content: string): string {
  const withoutPriority = content.replace(PRIORITY, "");
  if (OPEN_TASK.test(withoutPriority)) return `[ ] ${withoutPriority.replace(OPEN_TASK, "")}`;
  if (DONE_TASK.test(withoutPriority)) return `[x] ${withoutPriority.replace(DONE_TASK, "")}`;
  if (CANCELED_TASK.test(withoutPriority)) return `[x] ~~${withoutPriority.replace(CANCELED_TASK, "").trim()}~~`;
  return withoutPriority;
}

export function convertLogseqMarkdown(text: string, refs: BlockRefs): ConvertedPage {
  const properties: Record<string, string> = {};
  const tags = new Set<string>();
  const counts = { assets: 0 };
  const out: string[] = [];
  // Page properties are the leading property lines, either bare or as the
  // first bullet. They end at the first line that is not a property.
  let inPageProperties = true;
  let inCodeFence = false;

  const harvest = (key: string, value: string, isPage: boolean) => {
    const name = key.toLowerCase();
    if (name === "tags") parsePropertyList(value).forEach((t) => tags.add(normalizeTag(t)));
    if (isPage) properties[name] = value.trim();
  };

  for (const raw of text.split(/\r?\n/)) {
    const line = expandIndent(raw);
    const trimmed = line.trim();

    if (trimmed.startsWith("```")) {
      inCodeFence = !inCodeFence;
      inPageProperties = false;
      out.push(line);
      continue;
    }
    if (inCodeFence) {
      out.push(line);
      continue;
    }

    const bullet = line.match(BULLET);
    const propertySource = bullet ? bullet[2].trim() : trimmed;
    const prop = propertySource.match(PROPERTY_LINE);
    if (prop) {
      // A property-only bullet after the page properties is a block property
      // block: its tags still count, its content is metadata.
      harvest(prop[1], prop[2], inPageProperties);
      continue;
    }
    if (trimmed === "" && inPageProperties) continue;
    inPageProperties = false;

    if (bullet) {
      const content = convertInline(convertTaskMarker(bullet[2]), refs, tags, counts);
      out.push(`${bullet[1]}- ${content}`);
    } else {
      out.push(convertInline(line, refs, tags, counts));
    }
  }

  return { markdown: out.join("\n"), properties, tags: [...tags].filter(Boolean), skippedAssets: counts.assets };
}
