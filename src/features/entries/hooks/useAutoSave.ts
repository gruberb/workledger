import { useRef, useCallback, useEffect, useLayoutEffect } from "react";
import type { PartialBlock } from "@blocknote/core";

interface DocumentSource {
  readonly document: unknown[];
}

/**
 * Debounces editor saves and flushes the pending one on unmount, page hide
 * and tab hide, so the last keystrokes survive archive, filtering, view
 * switches and closing the tab.
 */
interface AutoSaveOptions {
  delayMs?: number;
  /**
   * Runs before every flush. Return the document source to force a save when
   * it just wrote pending block-level state (e.g. debounced drawing strokes)
   * into the document; return null otherwise.
   */
  beforeFlush?: () => DocumentSource | null;
}

export function useAutoSave(
  entryId: string,
  onSave: (entryId: string, blocks: PartialBlock[]) => Promise<void>,
  { delayMs = 500, beforeFlush }: AutoSaveOptions = {},
) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const editorRef = useRef<DocumentSource | null>(null);
  // Every array this hook has saved. Saves can resolve out of order behind a
  // long transaction, so remembering only the last one would let an older
  // save's state update look external and revert newer typing.
  const ownSavesRef = useRef(new WeakSet<object>());
  // Saved updatedAt is at least the save's start time, so content stamped
  // before that is older than what this editor already wrote.
  const lastSaveStartedAtRef = useRef(0);
  const inFlightRef = useRef(0);
  const onSaveRef = useRef(onSave);
  const beforeFlushRef = useRef(beforeFlush);

  useEffect(() => {
    onSaveRef.current = onSave;
    beforeFlushRef.current = beforeFlush;
  });

  const save = useCallback(() => {
    timerRef.current = null;
    const editor = editorRef.current;
    if (!editor) return;
    let blocks: PartialBlock[];
    try {
      blocks = editor.document as PartialBlock[];
    } catch (err) {
      console.error("[autosave] could not read editor document", err);
      return;
    }
    ownSavesRef.current.add(blocks);
    lastSaveStartedAtRef.current = Date.now();
    inFlightRef.current++;
    onSaveRef.current(entryId, blocks)
      .catch((err) => {
        console.error("[autosave] save failed", err);
      })
      .finally(() => {
        inFlightRef.current--;
      });
  }, [entryId]);

  const flush = useCallback(() => {
    const forced = beforeFlushRef.current?.() ?? null;
    if (forced) editorRef.current = forced;
    if (!timerRef.current && !forced) return;
    if (timerRef.current) clearTimeout(timerRef.current);
    save();
  }, [save]);

  const handleChange = useCallback(
    (editor: DocumentSource) => {
      editorRef.current = editor;
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(save, delayMs);
    },
    [save, delayMs],
  );

  /** True while typing is waiting to be saved or a save is still being written. */
  const isPending = useCallback(() => timerRef.current !== null || inFlightRef.current > 0, []);

  /** True for content this editor wrote itself, or content older than its last save. */
  const isOwnOrOlder = useCallback(
    (blocks: object, updatedAt: number) => ownSavesRef.current.has(blocks) || updatedAt < lastSaveStartedAtRef.current,
    [],
  );

  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === "hidden") flush();
    };
    window.addEventListener("pagehide", flush);
    document.addEventListener("visibilitychange", handleVisibility);
    return () => {
      window.removeEventListener("pagehide", flush);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [flush]);

  // Layout cleanup runs before the child BlockNoteView tears the editor down,
  // so the document is still readable here.
  useLayoutEffect(() => flush, [flush]);

  return { handleChange, isPending, isOwnOrOlder };
}
