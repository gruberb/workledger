import React, { useState, useRef, useCallback, useEffect, useContext, Component, type ReactNode } from "react";
import { createReactBlockSpec } from "@blocknote/react";
import "@excalidraw/excalidraw/index.css";
import { ThemeContext } from "../../hooks/ThemeContext.tsx";

const LazyExcalidraw = React.lazy(() =>
  import("@excalidraw/excalidraw").then((mod) => ({
    default: mod.Excalidraw,
  })),
);

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let exportToSvgFn: any = null;
import("@excalidraw/excalidraw").then((mod) => {
  exportToSvgFn = mod.exportToSvg;
});

class ExcalidrawErrorBoundary extends Component<
  { children: ReactNode },
  { hasError: boolean }
> {
  state = { hasError: false };
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="flex items-center justify-center h-full bg-stone-50 dark:bg-stone-900 text-stone-400 dark:text-stone-500 rounded-lg border border-stone-200 dark:border-stone-700 p-8">
          <div className="text-center">
            <div className="text-sm font-medium text-stone-500 dark:text-stone-400 mb-1">Drawing failed to load</div>
            <button
              className="text-xs text-amber-600 hover:text-amber-700"
              onClick={() => this.setState({ hasError: false })}
            >
              Try again
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

// CSS to force the BlockNote block wrapper and Excalidraw component to size correctly
const excalidrawBlockStyles = document.createElement("style");
excalidrawBlockStyles.textContent = `
  [data-content-type="excalidraw"] {
    width: 100%;
  }
  .excalidraw-wrapper .excalidraw.excalidraw-container {
    width: 100% !important;
    height: 100% !important;
    position: relative;
  }
  .excalidraw-wrapper {
    touch-action: none;
    isolation: isolate;
  }
  .excalidraw-preview svg {
    width: 100%;
    height: 100%;
    object-fit: contain;
  }
`;
document.head.appendChild(excalidrawBlockStyles);

const CANVAS_HEIGHT = 500;
const CANVAS_HEIGHT_MOBILE = 350;
const MIN_HEIGHT = 200;
const MAX_HEIGHT = 1200;
const MIN_WIDTH = 200;

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
  const [resizeHeight, setResizeHeight] = useState<number | null>(null);
  const [resizeWidth, setResizeWidth] = useState<number | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Always holds the latest Excalidraw state (avoids debounce staleness)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const latestDataRef = useRef<{ elements: readonly any[]; appState: any } | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const excalidrawAPIRef = useRef<any>(null);

  // Measure the max available width from the BlockNote wrapper's parent
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

  // Sync BlockNote wrapper width with our content width
  useEffect(() => {
    const wrapper = getBlockNoteWrapper(containerRef.current);
    if (!wrapper) return;
    if (isEditing) {
      // Edit mode: always full width
      wrapper.style.width = "100%";
    } else if (block.props.width && !resizeWidth) {
      // Preview with saved custom width
      wrapper.style.width = `${block.props.width}px`;
    } else if (resizeWidth) {
      // Actively resizing
      wrapper.style.width = `${resizeWidth}px`;
    } else {
      // Preview at full width
      wrapper.style.width = "100%";
    }
  }, [isEditing, block.props.width, resizeWidth]);

  const initialData = block.props.drawingData
    ? JSON.parse(block.props.drawingData)
    : undefined;

  const defaultHeight = window.matchMedia("(max-width: 767px)").matches ? CANVAS_HEIGHT_MOBILE : CANVAS_HEIGHT;

  const createResizeHandler = useCallback(
    (axis: "height" | "width" | "corner") => {
      const startResize = (startX: number, startY: number) => {
        const startHeight = resizeHeight ?? (block.props.height || defaultHeight);
        const startWidth = resizeWidth ?? (block.props.width || maxWidth);

        const onMove = (cx: number, cy: number) => {
          const dx = cx - startX;
          const dy = cy - startY;
          if (axis === "width" || axis === "corner") {
            setResizeWidth(Math.min(maxWidth, Math.max(MIN_WIDTH, startWidth + dx)));
          }
          if (axis === "height" || axis === "corner") {
            setResizeHeight(Math.min(MAX_HEIGHT, Math.max(MIN_HEIGHT, startHeight + dy)));
          }
        };

        const onEnd = (cx: number, cy: number) => {
          const dx = cx - startX;
          const dy = cy - startY;
          const props: { width?: number; height?: number } = {};
          if (axis === "width" || axis === "corner") {
            props.width = Math.min(maxWidth, Math.max(MIN_WIDTH, startWidth + dx));
            setResizeWidth(null);
          }
          if (axis === "height" || axis === "corner") {
            props.height = Math.min(MAX_HEIGHT, Math.max(MIN_HEIGHT, startHeight + dy));
            setResizeHeight(null);
          }
          editor.updateBlock(block, { props });
        };

        return { onMove, onEnd };
      };

      const handleMouse = (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        const { onMove, onEnd } = startResize(e.clientX, e.clientY);
        const handleMouseMove = (ev: MouseEvent) => onMove(ev.clientX, ev.clientY);
        const handleMouseUp = (ev: MouseEvent) => {
          document.removeEventListener("mousemove", handleMouseMove);
          document.removeEventListener("mouseup", handleMouseUp);
          onEnd(ev.clientX, ev.clientY);
        };
        document.addEventListener("mousemove", handleMouseMove);
        document.addEventListener("mouseup", handleMouseUp);
      };

      const handleTouch = (e: React.TouchEvent) => {
        e.stopPropagation();
        const touch = e.touches[0];
        const { onMove, onEnd } = startResize(touch.clientX, touch.clientY);
        const handleTouchMove = (ev: TouchEvent) => {
          ev.preventDefault();
          const t = ev.touches[0];
          onMove(t.clientX, t.clientY);
        };
        const handleTouchEnd = (ev: TouchEvent) => {
          document.removeEventListener("touchmove", handleTouchMove);
          document.removeEventListener("touchend", handleTouchEnd);
          const t = ev.changedTouches[0];
          onEnd(t.clientX, t.clientY);
        };
        document.addEventListener("touchmove", handleTouchMove, { passive: false });
        document.addEventListener("touchend", handleTouchEnd);
      };

      return { onMouseDown: handleMouse, onTouchStart: handleTouch };
    },
    [block, editor, resizeHeight, resizeWidth, maxWidth, defaultHeight],
  );

  const heightResize = createResizeHandler("height");
  const widthResize = createResizeHandler("width");
  const cornerResize = createResizeHandler("corner");

  const handleChange = useCallback(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (elements: readonly any[], appState: any) => {
      latestDataRef.current = { elements, appState };
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        const data = JSON.stringify({
          elements,
          appState: { viewBackgroundColor: appState.viewBackgroundColor },
        });
        editor.updateBlock(block, {
          props: { drawingData: data },
        });
      }, 300);
    },
    [block, editor],
  );

  const handleClickOutside = useCallback(
    async (e: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        // Cancel any pending debounce — we'll save everything now
        if (debounceRef.current) {
          clearTimeout(debounceRef.current);
          debounceRef.current = null;
        }

        // Use the latest in-memory data (not the possibly-stale block.props)
        const latest = latestDataRef.current;
        if (latest && exportToSvgFn) {
          const drawingData = JSON.stringify({
            elements: latest.elements,
            appState: { viewBackgroundColor: latest.appState?.viewBackgroundColor },
          });
          try {
            const svg = await exportToSvgFn({
              elements: [...latest.elements],
              appState: {
                ...(latest.appState || {}),
                exportBackground: true,
                viewBackgroundColor: "#f0f0f0",
                theme: "light",
              },
              files: null,
            });
            const svgString = new XMLSerializer().serializeToString(svg);
            editor.updateBlock(block, {
              props: { drawingData, previewSvg: svgString },
            });
          } catch {
            // At least save the drawing data
            editor.updateBlock(block, { props: { drawingData } });
          }
        }
        latestDataRef.current = null;
        setIsEditing(false);
      }
    },
    [block, editor],
  );

  useEffect(() => {
    if (isEditing) {
      document.addEventListener("mousedown", handleClickOutside);
      return () =>
        document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [isEditing, handleClickOutside]);

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  if (!editor.isEditable) {
    if (block.props.previewSvg) {
      return (
        <div
          className="excalidraw-preview rounded-lg overflow-hidden my-2"
          dangerouslySetInnerHTML={{ __html: block.props.previewSvg }}
        />
      );
    }
    return (
      <div className="text-stone-400 italic py-4 text-center">[Drawing]</div>
    );
  }

  // Preview mode (collapsed)
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
        {/* Bottom handle — height */}
        <div
          onMouseDown={heightResize.onMouseDown}
          onTouchStart={heightResize.onTouchStart}
          className="group flex items-center justify-center h-5 sm:h-3 cursor-row-resize select-none -mt-px"
          title="Drag to resize height"
        >
          <div className="w-12 sm:w-10 h-1.5 sm:h-1 rounded-full bg-gray-200 dark:bg-gray-700 group-hover:bg-gray-400 dark:group-hover:bg-gray-500 transition-colors" />
        </div>
        {/* Right handle — width */}
        <div
          onMouseDown={widthResize.onMouseDown}
          onTouchStart={widthResize.onTouchStart}
          className="group absolute -right-2 top-1/2 -translate-y-1/2 flex items-center justify-center w-6 sm:w-4 h-20 sm:h-16 cursor-col-resize select-none z-10"
          title="Drag to resize width"
        >
          <div className="h-12 sm:h-10 w-1.5 sm:w-1 rounded-full bg-gray-200 dark:bg-gray-700 group-hover:bg-gray-400 dark:group-hover:bg-gray-500 transition-colors" />
        </div>
        {/* Corner handle — both */}
        <div
          onMouseDown={cornerResize.onMouseDown}
          onTouchStart={cornerResize.onTouchStart}
          className="group absolute -bottom-1 -right-2 w-6 sm:w-4 h-6 sm:h-4 cursor-nwse-resize select-none z-10 flex items-center justify-center"
          title="Drag to resize"
        >
          <div className="w-3.5 sm:w-2.5 h-3.5 sm:h-2.5 rounded-sm bg-gray-200 dark:bg-gray-700 group-hover:bg-gray-400 dark:group-hover:bg-gray-500 transition-colors" />
        </div>
      </div>
    );
  }

  // Edit mode (full-width Excalidraw canvas)
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
              fallback={
                <div className="flex items-center justify-center h-full bg-stone-50 dark:bg-stone-900 text-stone-400 dark:text-stone-500">
                  Loading drawing canvas...
                </div>
              }
            >
              <LazyExcalidraw
                excalidrawAPI={(api: unknown) => {
                  excalidrawAPIRef.current = api;
                  // Zoom to fit all elements after mount
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
                UIOptions={{
                  canvasActions: {
                    saveToActiveFile: false,
                    loadScene: false,
                    export: false,
                  },
                }}
              />
            </React.Suspense>
          ) : (
            <div className="flex items-center justify-center h-full bg-stone-50 text-stone-400">
              Loading drawing canvas...
            </div>
          )}
        </ExcalidrawErrorBoundary>
      </div>
      {/* Bottom resize handle — height only in edit mode */}
      <div
        onMouseDown={heightResize.onMouseDown}
        onTouchStart={heightResize.onTouchStart}
        className="group flex items-center justify-center h-5 sm:h-3 cursor-row-resize select-none -mt-px"
        title="Drag to resize height"
      >
        <div className="w-12 sm:w-10 h-1.5 sm:h-1 rounded-full bg-gray-200 group-hover:bg-gray-400 transition-colors" />
      </div>
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
