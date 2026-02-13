import { getTagColor } from "../utils/tag-colors.ts";

interface FilterBannerProps {
  selectedTags: string[];
  textQuery: string;
  count: number;
  onRemoveTag: (tag: string) => void;
  onClearAll: () => void;
}

export function FilterBanner({ selectedTags, textQuery, count, onRemoveTag, onClearAll }: FilterBannerProps) {
  return (
    <div className="flex items-center gap-3 pt-6 pb-4 px-1 sticky top-0 z-10 bg-[var(--color-notebook-bg)]/95 backdrop-blur-sm border-b border-gray-100 dark:border-gray-800">
      <div className="flex items-center gap-2 flex-wrap">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-gray-400 shrink-0">
          <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
        </svg>
        {selectedTags.map((tag) => (
          <span key={tag} className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium ${getTagColor(tag)}`}>
            {tag}
            <button
              onClick={() => onRemoveTag(tag)}
              className="hover:opacity-70 transition-opacity"
            >
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </span>
        ))}
        {textQuery.trim() && (
          <span className="text-gray-800 dark:text-gray-200 font-medium text-sm">"{textQuery.trim()}"</span>
        )}
      </div>
      <span className="text-xs text-gray-400 shrink-0">
        {count} {count === 1 ? "entry" : "entries"}
      </span>
      <button
        onClick={onClearAll}
        className="ml-auto text-xs text-gray-400 hover:text-gray-600 transition-colors flex items-center gap-1 shrink-0"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <line x1="18" y1="6" x2="6" y2="18" />
          <line x1="6" y1="6" x2="18" y2="18" />
        </svg>
        Clear all
      </button>
    </div>
  );
}
