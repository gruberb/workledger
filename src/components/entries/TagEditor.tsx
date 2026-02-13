import { useState, useRef, useEffect } from "react";
import { getTagColor } from "../../utils/tag-colors.ts";

interface TagEditorProps {
  tags: string[];
  onChange: (tags: string[]) => void;
}

export function TagEditor({ tags, onChange }: TagEditorProps) {
  const [isAdding, setIsAdding] = useState(false);
  const [inputValue, setInputValue] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isAdding) {
      inputRef.current?.focus();
    }
  }, [isAdding]);

  const addTag = (value: string) => {
    const tag = value.trim().toLowerCase();
    if (tag && !tags.includes(tag)) {
      onChange([...tags, tag]);
    }
    setInputValue("");
    setIsAdding(false);
  };

  const removeTag = (tag: string) => {
    onChange(tags.filter((t) => t !== tag));
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      addTag(inputValue);
    } else if (e.key === "Escape") {
      e.preventDefault();
      setInputValue("");
      setIsAdding(false);
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-1.5 px-1">
      {tags.map((tag) => (
        <span
          key={tag}
          className={`
            inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium
            ${getTagColor(tag)}
          `}
        >
          {tag}
          <button
            onClick={() => removeTag(tag)}
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
        <input
          ref={inputRef}
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={() => {
            if (inputValue.trim()) {
              addTag(inputValue);
            } else {
              setIsAdding(false);
            }
          }}
          placeholder="tag name"
          className="text-xs bg-transparent outline-none border-b border-stone-300 px-1 py-0.5 w-20 text-stone-600 placeholder:text-stone-300"
          autoComplete="off"
          data-1p-ignore
        />
      ) : (
        <button
          onClick={() => setIsAdding(true)}
          className="text-xs text-stone-400 hover:text-stone-600 transition-colors px-1.5 py-0.5 rounded hover:bg-stone-100"
        >
          + tag
        </button>
      )}
    </div>
  );
}
