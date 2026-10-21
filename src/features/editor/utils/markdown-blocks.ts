import { BlockNoteEditor, type PartialBlock } from "@blocknote/core";
import { workledgerSchema } from "../components/EditorProvider.tsx";

const createParser = () => BlockNoteEditor.create({ schema: workledgerSchema });
let parser: ReturnType<typeof createParser> | null = null;

/**
 * Parses Markdown into notebook blocks. The headless editor is never mounted
 * and is reused, since creating one per call builds a whole ProseMirror schema.
 */
export function markdownToBlocks(markdown: string): PartialBlock[] {
  parser ??= createParser();
  return parser.tryParseMarkdownToBlocks(markdown) as PartialBlock[];
}
