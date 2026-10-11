import { getTagColor } from "../../../utils/tag-colors.ts";
import { CollapsibleSectionHeader } from "./CollapsibleSectionHeader.tsx";

interface SidebarTagCloudProps {
  allTags: string[];
  selectedTags: string[];
  onToggleTag: (tag: string) => void;
  collapsed?: boolean;
  onToggleCollapse?: () => void;
}

export function SidebarTagCloud({ allTags, selectedTags, onToggleTag, collapsed, onToggleCollapse }: SidebarTagCloudProps) {
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
  );
}
