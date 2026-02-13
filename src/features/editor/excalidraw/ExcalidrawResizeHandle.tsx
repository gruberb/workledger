interface ResizeHandleProps {
  axis: "height" | "width" | "corner";
  onMouseDown: (e: React.MouseEvent) => void;
  onTouchStart: (e: React.TouchEvent) => void;
}

export function ExcalidrawResizeHandle({ axis, onMouseDown, onTouchStart }: ResizeHandleProps) {
  if (axis === "height") {
    return (
      <div
        onMouseDown={onMouseDown}
        onTouchStart={onTouchStart}
        className="group flex items-center justify-center h-5 sm:h-3 cursor-row-resize select-none -mt-px"
        title="Drag to resize height"
      >
        <div className="w-12 sm:w-10 h-1.5 sm:h-1 rounded-full bg-gray-200 dark:bg-gray-700 group-hover:bg-gray-400 dark:group-hover:bg-gray-500 transition-colors" />
      </div>
    );
  }

  if (axis === "width") {
    return (
      <div
        onMouseDown={onMouseDown}
        onTouchStart={onTouchStart}
        className="group absolute -right-2 top-1/2 -translate-y-1/2 flex items-center justify-center w-6 sm:w-4 h-20 sm:h-16 cursor-col-resize select-none z-10"
        title="Drag to resize width"
      >
        <div className="h-12 sm:h-10 w-1.5 sm:w-1 rounded-full bg-gray-200 dark:bg-gray-700 group-hover:bg-gray-400 dark:group-hover:bg-gray-500 transition-colors" />
      </div>
    );
  }

  return (
    <div
      onMouseDown={onMouseDown}
      onTouchStart={onTouchStart}
      className="group absolute -bottom-1 -right-2 w-6 sm:w-4 h-6 sm:h-4 cursor-nwse-resize select-none z-10 flex items-center justify-center"
      title="Drag to resize"
    >
      <div className="w-3.5 sm:w-2.5 h-3.5 sm:h-2.5 rounded-sm bg-gray-200 dark:bg-gray-700 group-hover:bg-gray-400 dark:group-hover:bg-gray-500 transition-colors" />
    </div>
  );
}
