import { useState } from "react";
import { TagInput } from "./TagInput.tsx";

interface TagEditorProps {
  tags: string[];
  onChange: (tags: string[]) => void;
}

export function TagEditor({ tags, onChange }: TagEditorProps) {
  const [isAdding, setIsAdding] = useState(false);

  const addTag = (value: string) => {
    const tag = value.trim().toLowerCase();
    if (tag && !tags.includes(tag)) {
      onChange([...tags, tag]);
    }
    setIsAdding(false);
  };

  const removeTag = (tag: string) => {
    onChange(tags.filter((t) => t !== tag));
  };

  return (
    <div className="flex flex-wrap items-center gap-1.5 px-1">
      {tags.map((tag) => (
        <span
          key={tag}
          className={`
            inline-flex items-center gap-1 px-2 py-0.5 rounded border border-current/15 text-xs font-medium
            bg-[var(--color-notebook-surface)] text-[var(--color-notebook-muted)]
          `}
        >
          #{tag}
          <button
            onClick={() => removeTag(tag)}
            aria-label={`Remove tag ${tag}`}
            className="hover:opacity-70 transition-opacity ml-0.5"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </span>
      ))}

      {isAdding ? (
        <TagInput existing={tags} onAdd={addTag} onCancel={() => setIsAdding(false)} />
      ) : (
        <button
          onClick={() => setIsAdding(true)}
          className="text-xs text-[var(--color-notebook-muted)] hover:text-[var(--color-notebook-text)] transition-colors px-1.5 py-0.5 rounded hover:bg-stone-100 dark:hover:bg-stone-800"
        >
          + tag
        </button>
      )}
    </div>
  );
}
