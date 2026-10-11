import { lazy } from "react";

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
