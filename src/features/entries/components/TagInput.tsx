import { useEffect, useMemo, useRef, useState } from "react";
import { useEntriesData } from "../context/EntriesContext.tsx";
import { collectKnownTags, suggestTags } from "../utils/tag-suggestions.ts";

const MAX_SUGGESTIONS = 8;

interface TagInputProps {
  /** Tags the entry already has; they are not suggested again. */
  existing: string[];
  /** A tag was entered or picked; the parent normalizes it. */
  onAdd: (tag: string) => void;
  onCancel: () => void;
}

/** Text field for a new tag with a list of matching existing tags. */
export function TagInput({ existing, onAdd, onCancel }: TagInputProps) {
  const { storedTags, entriesByDay } = useEntriesData();
  const [value, setValue] = useState("");
  // -1: nothing highlighted, Enter adds what was typed.
  const [active, setActive] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Mounted only while a tag is being added, so the scan does not run per card.
  const known = useMemo(() => collectKnownTags(storedTags, entriesByDay), [storedTags, entriesByDay]);
  const suggestions = useMemo(
    () => suggestTags(known, value, existing, MAX_SUGGESTIONS),
    [known, value, existing],
  );

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      const step = e.key === "ArrowDown" ? 1 : -1;
      // Cycles through the suggestions and one extra "nothing highlighted" slot (-1).
      const slots = suggestions.length + 1;
      setActive((i) => ((i + 1 + step + slots) % slots) - 1);
    } else if (e.key === "Enter" || e.key === "Tab") {
      // Tab only completes a highlighted suggestion; otherwise it keeps its normal job.
      if (e.key === "Tab" && active < 0) return;
      e.preventDefault();
      onAdd(active >= 0 ? suggestions[active] : value);
    } else if (e.key === "Escape") {
      e.preventDefault();
      onCancel();
    }
  };

  return (
    <div className="relative">
      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={(e) => { setValue(e.target.value); setActive(-1); }}
        onKeyDown={handleKeyDown}
        onBlur={() => (value.trim() ? onAdd(value) : onCancel())}
        placeholder="tag name"
        role="combobox"
        aria-expanded={suggestions.length > 0}
        aria-controls="tag-suggestions"
        aria-activedescendant={active >= 0 ? `tag-suggestion-${active}` : undefined}
        aria-autocomplete="list"
        className="text-xs bg-transparent outline-none border-b border-stone-300 dark:border-stone-600 px-1 py-0.5 w-24 text-stone-600 dark:text-stone-300 placeholder:text-stone-300 dark:placeholder:text-stone-600"
        autoComplete="off"
        data-1p-ignore
      />
      {suggestions.length > 0 && (
        <ul
          id="tag-suggestions"
          role="listbox"
          className="absolute left-0 top-full mt-1 min-w-36 max-h-56 overflow-y-auto bg-[var(--color-notebook-surface)] border border-[var(--color-notebook-border)] rounded-lg shadow-xl py-1 z-50"
        >
          {suggestions.map((tag, i) => (
            <li
              key={tag}
              id={`tag-suggestion-${i}`}
              role="option"
              aria-selected={i === active}
              // mousedown, not click: the click would arrive after the input blurred and added the typed text.
              onMouseDown={(e) => { e.preventDefault(); onAdd(tag); }}
              className={`px-3 py-1.5 text-xs cursor-pointer text-[var(--color-notebook-text)] ${i === active ? "bg-[var(--color-notebook-surface-alt)]" : "hover:bg-[var(--color-notebook-surface-alt)]"}`}
            >
              {tag}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
