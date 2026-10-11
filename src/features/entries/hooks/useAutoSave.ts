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
export function useAutoSave(
  entryId: string,
  onSave: (entryId: string, blocks: PartialBlock[]) => Promise<void>,
  delayMs = 500,
) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const editorRef = useRef<DocumentSource | null>(null);
  /** The exact array passed to the last save; lets the editor recognise its own write. */
  const lastSavedBlocksRef = useRef<PartialBlock[] | null>(null);
  const onSaveRef = useRef(onSave);

  useEffect(() => {
    onSaveRef.current = onSave;
  }, [onSave]);

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
    lastSavedBlocksRef.current = blocks;
    onSaveRef.current(entryId, blocks).catch((err) => {
      console.error("[autosave] save failed", err);
    });
  }, [entryId]);

  const flush = useCallback(() => {
    if (!timerRef.current) return;
    clearTimeout(timerRef.current);
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

  const isPending = useCallback(() => timerRef.current !== null, []);

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

  return { handleChange, isPending, lastSavedBlocksRef };
}
