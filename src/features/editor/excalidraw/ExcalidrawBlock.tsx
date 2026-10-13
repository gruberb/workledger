import React, { useState, useRef, useEffect, useMemo } from "react";
import { createReactBlockSpec } from "@blocknote/react";
import { useThemeMode } from "../../theme/index.ts";
import { ExcalidrawErrorBoundary } from "./ExcalidrawErrorBoundary.tsx";
import { ExcalidrawResizeHandle } from "./ExcalidrawResizeHandle.tsx";
import { useExcalidrawResize } from "./useExcalidrawResize.ts";
import { useExcalidrawPersist } from "./useExcalidrawPersist.ts";
import { getLazyExcalidraw, resetLazyExcalidraw } from "./excalidrawLoader.ts";
import { parseDrawingData, sceneKey } from "./scene.ts";
import { sanitizeSvg } from "./sanitize-svg.ts";

const EXCALIDRAW_STYLES = `
  [data-content-type="excalidraw"] { width: 100%; }
  .excalidraw-wrapper .excalidraw.excalidraw-container { width: 100% !important; height: 100% !important; position: relative; }
  .excalidraw-wrapper { touch-action: none; isolation: isolate; }
  .excalidraw-preview svg { width: 100%; height: 100%; object-fit: contain; }
`;

let stylesInjected = false;
function ensureStyles() {
  if (stylesInjected) return;
  stylesInjected = true;
  const el = document.createElement("style");
  el.textContent = EXCALIDRAW_STYLES;
  document.head.appendChild(el);
}

const CANVAS_HEIGHT = 500;
const CANVAS_HEIGHT_MOBILE = 350;

/** Find the BlockNote wrapper element: [data-content-type="excalidraw"] */
function getBlockNoteWrapper(el: HTMLElement | null): HTMLElement | null {
  let current = el;
  while (current) {
    if (current.getAttribute?.("data-content-type") === "excalidraw") return current;
    current = current.parentElement;
  }
  return null;
}

// eslint-disable-next-line react-refresh/only-export-components
function ExcalidrawRenderer({
  block,
  editor,
}: {
  block: {
    id: string;
    props: { drawingData: string; previewSvg: string; previewKey: string; width: number; height: number };
  };
  editor: {
    isEditable: boolean;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    updateBlock: (block: any, update: any) => void;
  };
}) {
  useEffect(() => { ensureStyles(); }, []);
  const themeMode = useThemeMode();
  const [isEditing, setIsEditing] = useState(!block.props.previewSvg);
  const [maxWidth, setMaxWidth] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const excalidrawAPIRef = useRef<any>(null);

  const [LazyExcalidraw, setLazyExcalidraw] = useState(getLazyExcalidraw);

  const defaultHeight = window.matchMedia("(max-width: 767px)").matches ? CANVAS_HEIGHT_MOBILE : CANVAS_HEIGHT;

  // Every stroke batch rewrites drawingData, and a drawing with embedded images
  // is several MB of JSON. While editing, Excalidraw owns the scene: it reads
  // initialData only on mount and storedKey only matters outside edit mode.
  // So re-parse when editing starts or stops, not on each save in between.
  const parseKey = isEditing ? null : block.props.drawingData;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const drawing = useMemo(() => parseDrawingData(block.props.drawingData), [parseKey]);
  const storedKey = drawing.ok && drawing.snapshot ? sceneKey(drawing.snapshot) : null;
  // Read once: the persist hook tracks the saved version itself after mount.
  const [initialKey] = useState(storedKey);

  const { resizeHeight, resizeWidth, createResizeHandler } = useExcalidrawResize(block, editor, maxWidth, defaultHeight);
  const { handleChange, handleClickOutside, refreshPreview } = useExcalidrawPersist(block, editor, containerRef, setIsEditing, initialKey);

  // A preview can lag its drawing if the block unmounted before the preview
  // was re-rendered. previewKey is empty for drawings saved before it existed;
  // those are trusted as-is. While editing, the preview is refreshed on exit.
  const previewIsStale = !isEditing && !!block.props.previewSvg && !!block.props.previewKey && storedKey !== null && storedKey !== block.props.previewKey;
  useEffect(() => {
    if (previewIsStale && drawing.ok && drawing.snapshot && storedKey) refreshPreview(drawing.snapshot, storedKey);
  }, [previewIsStale, drawing, storedKey, refreshPreview]);

  const heightResize = createResizeHandler("height");
  const widthResize = createResizeHandler("width");
  const cornerResize = createResizeHandler("corner");

  // Measure max available width
  useEffect(() => {
    const wrapper = getBlockNoteWrapper(containerRef.current);
    const measureTarget = wrapper?.parentElement ?? containerRef.current;
    if (!measureTarget) return;
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const w = entry.contentRect.width;
        if (w > 0) setMaxWidth(w);
      }
    });
    observer.observe(measureTarget);
    return () => observer.disconnect();
  }, [isEditing]);

  // Sync BlockNote wrapper width
  useEffect(() => {
    const wrapper = getBlockNoteWrapper(containerRef.current);
    if (!wrapper) return;
    if (isEditing) {
      wrapper.style.width = "100%";
    } else if (block.props.width && !resizeWidth) {
      wrapper.style.width = `${block.props.width}px`;
    } else if (resizeWidth) {
      wrapper.style.width = `${resizeWidth}px`;
    } else {
      wrapper.style.width = "100%";
    }
  }, [isEditing, block.props.width, resizeWidth]);

  // Click outside to save and exit edit mode
  useEffect(() => {
    if (isEditing) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [isEditing, handleClickOutside]);

  const initialData = useMemo(() => {
    if (!drawing.ok || !drawing.snapshot) return undefined;
    const { elements, viewBackgroundColor, files } = drawing.snapshot;
    return { elements, appState: { viewBackgroundColor }, files: files ?? undefined };
  }, [drawing]);

  // Sanitizing parses the whole SVG, and resizing re-renders on every mousemove.
  const safePreviewSvg = useMemo(
    () => (block.props.previewSvg ? sanitizeSvg(block.props.previewSvg) : ""),
    [block.props.previewSvg],
  );

  // Non-editable mode
  if (!editor.isEditable) {
    if (block.props.previewSvg) {
      return <div className="excalidraw-preview rounded-lg overflow-hidden my-2" dangerouslySetInnerHTML={{ __html: safePreviewSvg }} />;
    }
    return <div className="text-stone-400 italic py-4 text-center">[Drawing]</div>;
  }

  // Preview mode
  if (!isEditing && block.props.previewSvg) {
    const previewHeight = resizeHeight ?? (block.props.height || defaultHeight);
    return (
      <div ref={containerRef} className="excalidraw-block my-2 relative" style={{ width: "100%" }}>
        <div
          className="excalidraw-preview cursor-pointer rounded-lg overflow-hidden hover:ring-2 hover:ring-orange-300 transition-all"
          style={{ height: `${previewHeight}px` }}
          onClick={() => setIsEditing(true)}
          dangerouslySetInnerHTML={{ __html: safePreviewSvg }}
        />
        <ExcalidrawResizeHandle axis="height" {...heightResize} />
        <ExcalidrawResizeHandle axis="width" {...widthResize} />
        <ExcalidrawResizeHandle axis="corner" {...cornerResize} />
      </div>
    );
  }

  // Edit mode
  const canvasHeight = resizeHeight ?? (block.props.height || defaultHeight);
  const ready = maxWidth >= 100;

  if (!drawing.ok) {
    return (
      <div ref={containerRef} className="excalidraw-block my-2 rounded-lg border border-stone-200 dark:border-stone-700 p-8 text-center text-sm text-stone-400">
        This drawing's data is damaged and can't be opened for editing.
      </div>
    );
  }

  return (
    <div ref={containerRef} className="excalidraw-block my-2" style={{ width: "100%" }}>
      <div
        className="excalidraw-wrapper rounded-lg border border-stone-200 dark:border-stone-700"
        style={{ width: "100%", height: `${canvasHeight}px` }}
        onWheel={(e) => e.stopPropagation()}
      >
        <ExcalidrawErrorBoundary onRetry={() => { resetLazyExcalidraw(); setLazyExcalidraw(() => getLazyExcalidraw()); }}>
          {ready ? (
            <React.Suspense
              fallback={<div className="flex items-center justify-center h-full bg-stone-50 dark:bg-stone-900 text-stone-400 dark:text-stone-500">Loading drawing canvas...</div>}
            >
              <LazyExcalidraw
                excalidrawAPI={(api: unknown) => {
                  excalidrawAPIRef.current = api;
                  setTimeout(() => {
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    const excalidrawAPI = api as any;
                    if (excalidrawAPI?.scrollToContent) {
                      excalidrawAPI.scrollToContent(undefined, { fitToContent: true, padding: 40 });
                    }
                  }, 100);
                }}
                initialData={initialData}
                onChange={handleChange}
                theme={themeMode}
                UIOptions={{ canvasActions: { saveToActiveFile: false, loadScene: false, export: false } }}
              />
            </React.Suspense>
          ) : (
            <div className="flex items-center justify-center h-full bg-stone-50 text-stone-400">Loading drawing canvas...</div>
          )}
        </ExcalidrawErrorBoundary>
      </div>
      <ExcalidrawResizeHandle axis="height" {...heightResize} />
    </div>
  );
}

export const excalidrawBlockSpec = createReactBlockSpec(
  {
    type: "excalidraw" as const,
    propSchema: {
      drawingData: { default: "" },
      previewSvg: { default: "" },
      // sceneKey of the drawing the preview was rendered from
      previewKey: { default: "" },
      width: { default: 0 },
      height: { default: CANVAS_HEIGHT },
    },
    content: "none" as const,
  },
  {
    render: (props) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return <ExcalidrawRenderer block={props.block as any} editor={props.editor as any} />;
    },
    toExternalHTML: (props) => {
      const { previewSvg } = props.block.props;
      if (previewSvg) {
        return <div data-excalidraw="true" dangerouslySetInnerHTML={{ __html: sanitizeSvg(previewSvg) }} />;
      }
      return <div data-excalidraw="true">[Drawing]</div>;
    },
  },
);
