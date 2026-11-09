import { memo } from "react";
import { CollapsibleSectionHeader } from "./CollapsibleSectionHeader.tsx";

interface SidebarTagCloudProps {
  allTags: string[];
  selectedTags: string[];
  onToggleTag: (tag: string) => void;
  collapsed?: boolean;
  onToggleCollapse?: () => void;
}

export const SidebarTagCloud = memo(function SidebarTagCloud({ allTags, selectedTags, onToggleTag, collapsed, onToggleCollapse }: SidebarTagCloudProps) {
  if (allTags.length === 0) return null;

  const isExpanded = !collapsed;

  return (
    <div>
      <CollapsibleSectionHeader label="Tags" count={allTags.length} expanded={isExpanded} onToggle={onToggleCollapse} />
      {isExpanded && (
        <div className="flex flex-wrap gap-1.5 px-1 pt-1">
          {allTags.map((tag) => (
            <button
              key={tag}
              onClick={() => onToggleTag(tag)}
              aria-pressed={selectedTags.includes(tag)}
              className={`tag-chip ${
                selectedTags.includes(tag)
                  ? "!bg-[var(--color-notebook-highlight)] !text-[var(--color-notebook-text)] !border-[var(--color-notebook-frame)]"
                  : "hover:!border-[var(--color-notebook-frame)]"
              }`}
            >
              #{tag}
            </button>
          ))}
        </div>
      )}
    </div>
  );
});
