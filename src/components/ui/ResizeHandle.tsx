import type { KeyboardEvent, PointerEvent } from "react";

interface ResizeHandleProps {
  /** Edge of the panel the handle sits on. */
  edge: "left" | "right";
  label: string;
  width: number;
  min: number;
  max: number;
  onPointerDown: (e: PointerEvent<HTMLElement>) => void;
  onKeyDown: (e: KeyboardEvent<HTMLElement>) => void;
}

/** Vertical drag strip on a side panel's inner edge; arrow keys resize it too. */
export function ResizeHandle({ edge, label, width, min, max, onPointerDown, onKeyDown }: ResizeHandleProps) {
  return (
    <div
      role="separator"
      aria-orientation="vertical"
      aria-label={label}
      aria-valuenow={width}
      aria-valuemin={min}
      aria-valuemax={max}
      tabIndex={0}
      onPointerDown={onPointerDown}
      onKeyDown={onKeyDown}
      className={`group absolute top-0 ${edge === "right" ? "-right-1" : "-left-1"} z-10 h-full w-2 cursor-col-resize touch-none outline-none`}
    >
      <div className="mx-auto h-full w-0.5 transition-colors group-hover:bg-[var(--color-notebook-accent)] group-focus-visible:bg-[var(--color-notebook-accent)] group-active:bg-[var(--color-notebook-accent)]" />
    </div>
  );
}
