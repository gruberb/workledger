// Serialization and change detection for Excalidraw scenes stored in a block's
// `drawingData` prop. Kept free of the Excalidraw import so the editor can
// use it without loading the Excalidraw bundle.

/* eslint-disable @typescript-eslint/no-explicit-any */
export interface SceneSnapshot {
  elements: readonly any[];
  viewBackgroundColor?: string;
  files: Record<string, any> | null;
}
/* eslint-enable @typescript-eslint/no-explicit-any */

/** Only files referenced by live image elements are kept, so deleted images don't bloat entries. */
function referencedFiles(snapshot: SceneSnapshot): Record<string, unknown> | undefined {
  if (!snapshot.files) return undefined;
  const ids = new Set(
    snapshot.elements.filter((el) => el.type === "image" && !el.isDeleted && el.fileId).map((el) => el.fileId as string),
  );
  if (ids.size === 0) return undefined;
  const kept: Record<string, unknown> = {};
  for (const id of ids) {
    if (snapshot.files[id]) kept[id] = snapshot.files[id];
  }
  return kept;
}

export function serializeScene(snapshot: SceneSnapshot): string {
  return JSON.stringify({
    elements: snapshot.elements,
    appState: { viewBackgroundColor: snapshot.viewBackgroundColor },
    files: referencedFiles(snapshot),
  });
}

/**
 * Cheap fingerprint of what is persisted. Excalidraw bumps an element's
 * `version` on every edit (including deletion), so the sum changes for real
 * edits but not for selection, scroll or zoom, which also fire onChange.
 * Mirrors Excalidraw's getSceneVersion without importing it.
 */
export function sceneKey(snapshot: SceneSnapshot): string {
  let versionSum = 0;
  for (const el of snapshot.elements) versionSum += el.version ?? 0;
  const fileCount = snapshot.files ? Object.keys(snapshot.files).length : 0;
  return `${snapshot.elements.length}:${versionSum}:${snapshot.viewBackgroundColor ?? ""}:${fileCount}`;
}

export type ParsedDrawing =
  | { ok: true; snapshot: SceneSnapshot | null }
  | { ok: false };

/** Never throws: drawingData can arrive corrupted through import or sync. */
export function parseDrawingData(drawingData: string): ParsedDrawing {
  if (!drawingData) return { ok: true, snapshot: null };
  try {
    const data = JSON.parse(drawingData);
    if (!data || !Array.isArray(data.elements)) return { ok: false };
    return {
      ok: true,
      snapshot: {
        elements: data.elements,
        viewBackgroundColor: data.appState?.viewBackgroundColor,
        files: data.files && typeof data.files === "object" ? data.files : null,
      },
    };
  } catch {
    return { ok: false };
  }
}
