import type { BlockNoteEditor } from "@blocknote/core";
import { insertOrUpdateBlockForSlashMenu } from "@blocknote/core/extensions";
import {
  getDefaultReactSlashMenuItems,
  type DefaultReactSuggestionItem,
} from "@blocknote/react";

export function getWorkLedgerSlashMenuItems(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  editor: BlockNoteEditor<any, any, any>,
  /** Starts dictation into this note; omit where the browser has no speech recognition. */
  onDictate?: () => void,
): DefaultReactSuggestionItem[] {
  const defaults = getDefaultReactSlashMenuItems(editor);

  const drawItem: DefaultReactSuggestionItem = {
    title: "Drawing",
    onItemClick: () => {
      insertOrUpdateBlockForSlashMenu(
        editor,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        { type: "excalidraw" as any, props: {} },
      );
    },
    subtext: "Inline Excalidraw canvas",
    aliases: ["draw", "sketch", "diagram", "whiteboard", "excalidraw"],
    group: "Media",
  };

  // Sort by group so all "Media" items are contiguous (avoids duplicate key warning)
  const dictateItem: DefaultReactSuggestionItem | null = onDictate
    ? {
        title: "Dictate",
        onItemClick: onDictate,
        subtext: "Speech to text. Your browser may send the audio to its speech service",
        aliases: ["dictation", "speech", "voice", "microphone", "mic", "speak"],
        group: "Media",
      }
    : null;

  const items = [...defaults, drawItem, ...(dictateItem ? [dictateItem] : [])];
  items.sort((a, b) => (a.group ?? "").localeCompare(b.group ?? ""));
  return items;
}
