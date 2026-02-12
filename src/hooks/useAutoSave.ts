import { useRef, useCallback, useEffect } from "react";
import type { Block, BlockNoteEditor } from "@blocknote/core";
import type { WorkLedgerEntry } from "../types/entry.ts";
import { updateSearchIndex } from "../storage/search-index.ts";

export function useAutoSave(
  entry: WorkLedgerEntry | null,
  onSave: (entry: WorkLedgerEntry) => Promise<void>,
) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latestEntryRef = useRef(entry);

  useEffect(() => {
    latestEntryRef.current = entry;
  }, [entry]);

  const handleChange = useCallback(
    (editor: BlockNoteEditor) => {
      if (timerRef.current) clearTimeout(timerRef.current);

      timerRef.current = setTimeout(async () => {
        const current = latestEntryRef.current;
        if (!current) return;

        const blocks = editor.document;
        const updated: WorkLedgerEntry = {
          ...current,
          blocks: blocks,
          updatedAt: Date.now(),
        };
        latestEntryRef.current = updated;
        await onSave(updated);
        await updateSearchIndex(
          updated.id,
          updated.dayKey,
          blocks as Block[],
          updated.tags ?? [],
        );
      }, 500);
    },
    [onSave],
  );

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  return { handleChange };
}
