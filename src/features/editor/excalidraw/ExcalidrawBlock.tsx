import React, { useState, useRef, useEffect, useContext } from "react";
import { createReactBlockSpec } from "@blocknote/react";
import "@excalidraw/excalidraw/index.css";
import { ThemeContext } from "../../theme/context/ThemeContext.tsx";
import { ExcalidrawErrorBoundary } from "./ExcalidrawErrorBoundary.tsx";
import { ExcalidrawResizeHandle } from "./ExcalidrawResizeHandle.tsx";
import { useExcalidrawResize } from "./useExcalidrawResize.ts";
import { useExcalidrawPersist } from "./useExcalidrawPersist.ts";

const LazyExcalidraw = React.lazy(() =>
  import("@excalidraw/excalidraw").then((mod) => ({
    default: mod.Excalidraw,
  })),
);

// CSS to force the BlockNote block wrapper and Excalidraw component to size correctly
const excalidrawBlockStyles = document.createElement("style");
excalidrawBlockStyles.textContent = `
  [data-content-type="excalidraw"] { width: 100%; }
  .excalidraw-wrapper .excalidraw.excalidraw-container { width: 100% !important; height: 100% !important; position: relative; }
  .excalidraw-wrapper { touch-action: none; isolation: isolate; }
  .excalidraw-preview svg { width: 100%; height: 100%; object-fit: contain; }
`;
document.head.appendChild(excalidrawBlockStyles);

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
    props: { drawingData: string; previewSvg: string; width: number; height: number };
  };
  editor: {
    isEditable: boolean;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    updateBlock: (block: any, update: any) => void;
  };
}) {
  const themeMode = useContext(ThemeContext);
  const [isEditing, setIsEditing] = useState(!block.props.previewSvg);
  const [maxWidth, setMaxWidth] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const excalidrawAPIRef = useRef<any>(null);

  const defaultHeight = window.matchMedia("(max-width: 767px)").matches ? CANVAS_HEIGHT_MOBILE : CANVAS_HEIGHT;

  const { resizeHeight, resizeWidth, createResizeHandler } = useExcalidrawResize(block, editor, maxWidth, defaultHeight);
  const { handleChange, handleClickOutside } = useExcalidrawPersist(block, editor, containerRef, setIsEditing);

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

  const initialData = block.props.drawingData ? JSON.parse(block.props.drawingData) : undefined;

  // Non-editable mode
  if (!editor.isEditable) {
    if (block.props.previewSvg) {
      return <div className="excalidraw-preview rounded-lg overflow-hidden my-2" dangerouslySetInnerHTML={{ __html: block.props.previewSvg }} />;
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
          dangerouslySetInnerHTML={{ __html: block.props.previewSvg }}
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

  return (
    <div ref={containerRef} className="excalidraw-block my-2" style={{ width: "100%" }}>
      <div
        className="excalidraw-wrapper rounded-lg border border-stone-200 dark:border-stone-700"
        style={{ width: "100%", height: `${canvasHeight}px` }}
        onWheel={(e) => e.stopPropagation()}
      >
        <ExcalidrawErrorBoundary>
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
  },
);
