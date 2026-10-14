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
              className={`px-2.5 py-1.5 rounded border text-sm transition-colors ${
                selectedTags.includes(tag)
                  ? "border-[var(--color-notebook-accent)] text-[var(--color-notebook-accent)] bg-[var(--color-notebook-surface-alt)]"
                  : "border-[var(--color-notebook-border)] text-[var(--color-notebook-muted)] hover:border-[var(--color-notebook-accent)]"
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
