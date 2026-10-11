import { useRef, useCallback, useEffect } from "react";
import { loadExcalidraw } from "./excalidrawLoader.ts";
import { serializeScene, sceneKey, type SceneSnapshot } from "./scene.ts";

// Batches rapid strokes into one block update (and one entry autosave).
const SAVE_DEBOUNCE_MS = 300;

/* eslint-disable @typescript-eslint/no-explicit-any */
interface PersistBlock {
  id: string;
  props: { drawingData: string; previewSvg: string; previewKey: string };
}

interface PersistEditor {
  updateBlock: (block: any, update: any) => void;
}
/* eslint-enable @typescript-eslint/no-explicit-any */

export async function renderPreviewSvg(snapshot: SceneSnapshot): Promise<string> {
  const { exportToSvg } = await loadExcalidraw();
  const svg = await exportToSvg({
    elements: [...snapshot.elements],
    appState: {
      exportBackground: true,
      viewBackgroundColor: "#f0f0f0",
      theme: "light",
    },
    files: snapshot.files,
  });
  return new XMLSerializer().serializeToString(svg);
}

/** Block updates fail once the block is deleted or the editor is gone; nothing to save then. */
function safeUpdate(editor: PersistEditor, block: PersistBlock, props: Partial<PersistBlock["props"]>) {
  try {
    editor.updateBlock(block, { props });
  } catch {
    // block or editor no longer exists
  }
}

export function useExcalidrawPersist(
  block: PersistBlock,
  editor: PersistEditor,
  containerRef: React.RefObject<HTMLDivElement | null>,
  setIsEditing: (editing: boolean) => void,
  initialKey: string | null,
) {
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latestRef = useRef<{ snapshot: SceneSnapshot; key: string } | null>(null);
  const savedKeyRef = useRef(initialKey);
  // Unmount cleanup runs after the last render, so it reads these refs
  // instead of a stale closure.
  const blockRef = useRef(block);
  const editorRef = useRef(editor);
  useEffect(() => {
    blockRef.current = block;
    editorRef.current = editor;
  });

  const saveDrawing = useCallback(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = null;
    const latest = latestRef.current;
    if (!latest || latest.key === savedKeyRef.current) return null;
    safeUpdate(editorRef.current, blockRef.current, { drawingData: serializeScene(latest.snapshot) });
    savedKeyRef.current = latest.key;
    return latest;
  }, []);

  const handleChange = useCallback(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (elements: readonly any[], appState: any, files: Record<string, any> | null) => {
      const snapshot: SceneSnapshot = { elements, viewBackgroundColor: appState?.viewBackgroundColor, files };
      const key = sceneKey(snapshot);
      latestRef.current = { snapshot, key };
      // Selection, scroll and zoom also fire onChange; they change nothing we store.
      if (key === savedKeyRef.current) {
        if (debounceRef.current) clearTimeout(debounceRef.current);
        debounceRef.current = null;
        return;
      }
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(saveDrawing, SAVE_DEBOUNCE_MS);
    },
    [saveDrawing],
  );

  const refreshPreview = useCallback(async (snapshot: SceneSnapshot, key: string) => {
    try {
      const previewSvg = await renderPreviewSvg(snapshot);
      safeUpdate(editorRef.current, blockRef.current, { previewSvg, previewKey: key });
    } catch {
      // keep the old preview; drawingData is already saved
    }
  }, []);

  const handleClickOutside = useCallback(
    async (e: MouseEvent) => {
      if (!containerRef.current || containerRef.current.contains(e.target as Node)) return;
      saveDrawing();
      const latest = latestRef.current;
      if (latest && latest.key !== blockRef.current.props.previewKey) {
        await refreshPreview(latest.snapshot, latest.key);
      }
      setIsEditing(false);
    },
    [containerRef, setIsEditing, saveDrawing, refreshPreview],
  );

  // Flush pending strokes when the block unmounts (entry archived, scrolled
  // out, editor torn down). The preview is regenerated on a best-effort
  // basis; if that fails, the stale-preview check on next mount catches it.
  useEffect(() => () => {
    const latest = saveDrawing() ?? latestRef.current;
    if (latest && latest.key !== blockRef.current.props.previewKey) {
      refreshPreview(latest.snapshot, latest.key);
    }
  }, [saveDrawing, refreshPreview]);

  return { handleChange, handleClickOutside, refreshPreview };
}
