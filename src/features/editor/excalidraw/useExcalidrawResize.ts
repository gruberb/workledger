import { useCallback, useState } from "react";
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

  return { resizeHeight, resizeWidth, createResizeHandler };
}
