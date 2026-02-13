import type { BlockNoteEditor } from "@blocknote/core";
import { insertOrUpdateBlockForSlashMenu } from "@blocknote/core/extensions";
import {
  getDefaultReactSlashMenuItems,
  type DefaultReactSuggestionItem,
} from "@blocknote/react";

export function getWorkLedgerSlashMenuItems(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  editor: BlockNoteEditor<any, any, any>,
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
  const items = [...defaults, drawItem];
  items.sort((a, b) => (a.group ?? "").localeCompare(b.group ?? ""));
  return items;
}
