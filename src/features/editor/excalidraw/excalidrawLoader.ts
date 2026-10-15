import { lazy } from "react";
import type { SceneSnapshot } from "./scene.ts";

type ExcalidrawModule = typeof import("@excalidraw/excalidraw");

let modulePromise: Promise<ExcalidrawModule> | null = null;

/**
 * Loads Excalidraw (about 1 MB) and its CSS on first use instead of at startup.
 * A failed load is not cached, so a retry can succeed after a network blip.
 */
export function loadExcalidraw(): Promise<ExcalidrawModule> {
  modulePromise ??= Promise.all([
    import("@excalidraw/excalidraw"),
    import("@excalidraw/excalidraw/index.css"),
  ])
    .then(([mod]) => mod)
    .catch((err) => {
      modulePromise = null;
      throw err;
    });
  return modulePromise;
}

/** The static SVG shown while a drawing isn't being edited, also used by exports. */
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

function createLazyExcalidraw() {
  return lazy(() => loadExcalidraw().then((mod) => ({ default: mod.Excalidraw })));
}

let LazyExcalidraw = createLazyExcalidraw();

export function getLazyExcalidraw() {
  return LazyExcalidraw;
}

/** React.lazy caches a rejected load forever; retrying needs a fresh lazy component. */
export function resetLazyExcalidraw() {
  LazyExcalidraw = createLazyExcalidraw();
}
