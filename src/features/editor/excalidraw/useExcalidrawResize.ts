import { useCallback, useEffect, useRef, useState } from "react";
import type React from "react";

const MIN_HEIGHT = 200;
const MAX_HEIGHT = 1200;
const MIN_WIDTH = 200;

export function useExcalidrawResize(
  block: { props: { width: number; height: number } },
  editor: {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    updateBlock: (block: any, update: any) => void;
  },
  maxWidth: number,
  defaultHeight: number,
) {
  const [resizeHeight, setResizeHeight] = useState<number | null>(null);
  const [resizeWidth, setResizeWidth] = useState<number | null>(null);
  // Removes the document listeners of an in-progress drag, so unmounting
  // mid-drag doesn't leave them attached.
  const endDragRef = useRef<(() => void) | null>(null);

  useEffect(() => () => endDragRef.current?.(), []);

  const createResizeHandler = useCallback(
    (axis: "height" | "width" | "corner") => {
      const startResize = (startX: number, startY: number) => {
        const startHeight = resizeHeight ?? (block.props.height || defaultHeight);
        const startWidth = resizeWidth ?? (block.props.width || maxWidth);
        const clampWidth = (dx: number) => Math.min(maxWidth, Math.max(MIN_WIDTH, startWidth + dx));
        const clampHeight = (dy: number) => Math.min(MAX_HEIGHT, Math.max(MIN_HEIGHT, startHeight + dy));

        const onMove = (cx: number, cy: number) => {
          if (axis === "width" || axis === "corner") setResizeWidth(clampWidth(cx - startX));
          if (axis === "height" || axis === "corner") setResizeHeight(clampHeight(cy - startY));
        };

        const reset = () => {
          setResizeWidth(null);
          setResizeHeight(null);
        };

        const onEnd = (cx: number, cy: number) => {
          const dx = cx - startX;
          const dy = cy - startY;
          reset();
          // A plain click on a handle must not write the block (and trigger an autosave).
          if (dx === 0 && dy === 0) return;
          const props: { width?: number; height?: number } = {};
          if (axis === "width" || axis === "corner") props.width = clampWidth(dx);
          if (axis === "height" || axis === "corner") props.height = clampHeight(dy);
          editor.updateBlock(block, { props });
        };

        return { onMove, onEnd, reset };
      };

      const handleMouse = (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        endDragRef.current?.();
        const { onMove, onEnd } = startResize(e.clientX, e.clientY);
        const handleMouseMove = (ev: MouseEvent) => onMove(ev.clientX, ev.clientY);
        const detach = () => {
          document.removeEventListener("mousemove", handleMouseMove);
          document.removeEventListener("mouseup", handleMouseUp);
          endDragRef.current = null;
        };
        const handleMouseUp = (ev: MouseEvent) => {
          detach();
          onEnd(ev.clientX, ev.clientY);
        };
        document.addEventListener("mousemove", handleMouseMove);
        document.addEventListener("mouseup", handleMouseUp);
        endDragRef.current = detach;
      };

      const handleTouch = (e: React.TouchEvent) => {
        e.stopPropagation();
        endDragRef.current?.();
        const touch = e.touches[0];
        const { onMove, onEnd, reset } = startResize(touch.clientX, touch.clientY);
        const handleTouchMove = (ev: TouchEvent) => {
          ev.preventDefault();
          const t = ev.touches[0];
          onMove(t.clientX, t.clientY);
        };
        const detach = () => {
          document.removeEventListener("touchmove", handleTouchMove);
          document.removeEventListener("touchend", handleTouchEnd);
          document.removeEventListener("touchcancel", handleTouchCancel);
          endDragRef.current = null;
        };
        const handleTouchEnd = (ev: TouchEvent) => {
          detach();
          const t = ev.changedTouches[0];
          onEnd(t.clientX, t.clientY);
        };
        // The OS took over the gesture: drop the preview size, keep the stored one.
        const handleTouchCancel = () => {
          detach();
          reset();
        };
        document.addEventListener("touchmove", handleTouchMove, { passive: false });
        document.addEventListener("touchend", handleTouchEnd);
        document.addEventListener("touchcancel", handleTouchCancel);
        endDragRef.current = detach;
      };

      return { onMouseDown: handleMouse, onTouchStart: handleTouch };
    },
    [block, editor, resizeHeight, resizeWidth, maxWidth, defaultHeight],
  );

  return { resizeHeight, resizeWidth, createResizeHandler };
}
