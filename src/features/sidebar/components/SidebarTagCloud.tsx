import { useState, useCallback, useRef } from "react";
import { getTagColor } from "../../entries/utils/tag-colors.ts";

interface SidebarTagCloudProps {
  allTags: string[];
  selectedTags: string[];
  onToggleTag: (tag: string) => void;
}

export function SidebarTagCloud({ allTags, selectedTags, onToggleTag }: SidebarTagCloudProps) {
  const [tagsExpanded, setTagsExpanded] = useState(true);
  const [tagsHeight, setTagsHeight] = useState(120);
  const dragRef = useRef<{ startY: number; startHeight: number } | null>(null);

  const handleDragStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    dragRef.current = { startY: e.clientY, startHeight: tagsHeight };

    const onMove = (ev: MouseEvent) => {
      if (!dragRef.current) return;
      const delta = dragRef.current.startY - ev.clientY;
      const newHeight = Math.max(60, Math.min(300, dragRef.current.startHeight + delta));
      setTagsHeight(newHeight);
    };
    const onUp = () => {
      dragRef.current = null;
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
    };
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  }, [tagsHeight]);

  if (allTags.length === 0) return null;

  return (
    <div className="shrink-0 mt-1">
      {tagsExpanded && (
        <div
          onMouseDown={handleDragStart}
          className="h-2 cursor-row-resize flex items-center justify-center group"
        >
          <div className="w-8 h-0.5 rounded-full bg-gray-200 dark:bg-gray-700 group-hover:bg-gray-400 dark:group-hover:bg-gray-500 transition-colors" />
        </div>
      )}
      <div className="border-t border-gray-100 dark:border-gray-800 pt-2">
        <button
          onClick={() => setTagsExpanded((prev) => !prev)}
          className="flex items-center gap-1.5 w-full text-left px-1 mb-2"
        >
          <svg
            width="10"
            height="10"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            className={`text-gray-400 transition-transform duration-200 ${tagsExpanded ? "rotate-90" : ""}`}
          >
            <polyline points="9 18 15 12 9 6" />
          </svg>
          <span className={`uppercase tracking-wider text-gray-400 font-medium ${tagsExpanded ? "text-[11px]" : "text-xs"}`}>
            Tags
          </span>
          <span className={`text-gray-300 ml-1 ${tagsExpanded ? "text-[10px]" : "text-[11px]"}`}>{allTags.length}</span>
        </button>
        {tagsExpanded && (
          <div
            className="flex flex-wrap gap-1.5 px-1 overflow-y-auto"
            style={{ maxHeight: tagsHeight }}
          >
            {allTags.map((tag) => (
              <button
                key={tag}
                onClick={() => onToggleTag(tag)}
                className={`
                  px-2 py-0.5 rounded-full text-[11px] font-medium
                  transition-opacity hover:opacity-80
                  ${getTagColor(tag)}
                  ${selectedTags.includes(tag) ? "ring-2 ring-offset-1 ring-gray-400 dark:ring-gray-500" : ""}
                `}
              >
                {tag}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
