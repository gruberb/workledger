import { useRef, useCallback, useEffect } from "react";
import type { Block, BlockNoteEditor } from "@blocknote/core";
import type { WorkLedgerEntry } from "../types/entry.ts";
import { updateSearchIndex } from "../storage/search-index.ts";
import { updateBacklinks } from "../storage/backlinks.ts";

export function useAutoSave(
  entry: WorkLedgerEntry | null,
  onSave: (entry: WorkLedgerEntry) => Promise<void>,
) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latestEntryRef = useRef(entry);
  const lastSavedAtRef = useRef<number | null>(null);

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
        const now = Date.now();
        const updated: WorkLedgerEntry = {
          ...current,
          blocks: blocks,
          updatedAt: now,
        };
        latestEntryRef.current = updated;
        lastSavedAtRef.current = now;
        await onSave(updated);
        await updateSearchIndex(
          updated.id,
          updated.dayKey,
          blocks as Block[],
          updated.tags ?? [],
        );
        await updateBacklinks(updated.id, blocks);
      }, 500);
    },
    [onSave],
  );

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  return { handleChange, lastSavedAtRef };
}
