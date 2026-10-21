import { useCallback, useLayoutEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";

export interface PanelWidthLimits {
  min: number;
  max: number;
  /** Dragging below this width closes the panel on release. */
  collapseBelow: number;
}

export interface ResizablePanelOptions extends PanelWidthLimits {
  /** CSS custom property holding the width; the panel and the page padding both read it. */
  cssVar: string;
  storageKey: string;
  defaultWidth: number;
  /** Edge the panel is docked to. A left panel grows to the right, a right panel to the left. */
  side: "left" | "right";
  onCollapse: () => void;
}

const KEY_STEP = 16;

/** Width for a raw drag position: clamped to the limits, or a request to close. */
export function resolvePanelWidth(raw: number, { min, max, collapseBelow }: PanelWidthLimits): { width: number; collapse: boolean } {
  return { width: Math.min(max, Math.max(min, raw)), collapse: raw < collapseBelow };
}

export function readStoredWidth(value: string | null, fallback: number, { min, max }: PanelWidthLimits): number {
  const n = Number(value);
  return value !== null && Number.isFinite(n) && n >= min && n <= max ? n : fallback;
}

function store(key: string, width: number) {
  try {
    localStorage.setItem(key, String(width));
  } catch {
    // Private mode or a full quota: the width still applies for this session.
  }
}

/**
 * Drag-to-resize for a docked side panel. The width lives in a CSS variable on
 * <html>, so a drag repaints without re-rendering React trees (the entry stream
 * holds many editors).
 */
export function useResizablePanel({ cssVar, storageKey, defaultWidth, side, min, max, collapseBelow, onCollapse }: ResizablePanelOptions) {
  const [width, setWidth] = useState(() => {
    let stored: string | null = null;
    try { stored = localStorage.getItem(storageKey); } catch { /* use the default */ }
    return readStoredWidth(stored, defaultWidth, { min, max, collapseBelow });
  });
  const [collapsing, setCollapsing] = useState(false);
  const widthRef = useRef(width);

  useLayoutEffect(() => {
    widthRef.current = width;
    document.documentElement.style.setProperty(cssVar, `${width}px`);
  }, [cssVar, width]);

  const handlePointerDown = useCallback((e: PointerEvent<HTMLElement>) => {
    if (e.button !== 0) return;
    e.preventDefault();
    const handle = e.currentTarget;
    handle.setPointerCapture(e.pointerId);
    const root = document.documentElement;
    // Turns off layout transitions and text selection while dragging (app.css).
    root.dataset.resizing = "";
    const startX = e.clientX;
    const startWidth = widthRef.current;
    let latest = { width: startWidth, collapse: false };
    let frame = 0;

    const handleMove = (ev: globalThis.PointerEvent) => {
      const dx = ev.clientX - startX;
      latest = resolvePanelWidth(startWidth + (side === "left" ? dx : -dx), { min, max, collapseBelow });
      setCollapsing(latest.collapse);
      // One layout per frame: every width change reflows the whole entry stream.
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => root.style.setProperty(cssVar, `${latest.width}px`));
    };
    const handleEnd = () => {
      cancelAnimationFrame(frame);
      handle.removeEventListener("pointermove", handleMove);
      handle.removeEventListener("lostpointercapture", handleEnd);
      delete root.dataset.resizing;
      setCollapsing(false);
      if (latest.collapse) {
        // Reopening restores the width from before the drag.
        root.style.setProperty(cssVar, `${startWidth}px`);
        onCollapse();
        return;
      }
      setWidth(latest.width);
      store(storageKey, latest.width);
    };
    handle.addEventListener("pointermove", handleMove);
    // Fires after pointerup and pointercancel, so it covers both.
    handle.addEventListener("lostpointercapture", handleEnd);
  }, [cssVar, storageKey, side, min, max, collapseBelow, onCollapse]);

  const handleKeyDown = useCallback((e: KeyboardEvent<HTMLElement>) => {
    if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
    e.preventDefault();
    const grow = (e.key === "ArrowRight") === (side === "left");
    const next = resolvePanelWidth(widthRef.current + (grow ? KEY_STEP : -KEY_STEP), { min, max, collapseBelow }).width;
    setWidth(next);
    store(storageKey, next);
  }, [storageKey, side, min, max, collapseBelow]);

  return { width, collapsing, handlePointerDown, handleKeyDown };
}
