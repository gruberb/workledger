import { useMemo } from "react";
import { useEntriesActions } from "../../features/entries/index.ts";
import type { NoteActions } from "../../features/ai/index.ts";
import { scrollToEntry } from "../../utils/scroll.ts";

// The editor chunk is already loaded on desktop (the only place the AI sidebar shows).
const loadParser = () => import("../../features/editor/index.ts").then((m) => m.markdownToBlocks);

/** Lets the AI sidebar write replies into notes without importing the editor. */
export function useAINoteActions(): NoteActions {
  const { appendEntryBlocks, createEntry } = useEntriesActions();
  return useMemo<NoteActions>(() => ({
    addToEntry: async (entryId, markdown) => {
      const markdownToBlocks = await loadParser();
      const found = await appendEntryBlocks(entryId, markdownToBlocks(markdown));
      if (!found) throw new Error("The note no longer exists");
    },
    createEntry: async (markdown) => {
      const markdownToBlocks = await loadParser();
      const entry = await createEntry({ blocks: markdownToBlocks(markdown) });
      scrollToEntry(entry.id);
    },
  }), [appendEntryBlocks, createEntry]);
}
