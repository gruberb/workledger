import { getTagColor } from "../utils/tag-colors.ts";

interface FilterBannerProps {
  query: string;
  count: number;
  onClear?: () => void;
}

export function FilterBanner({ query, count, onClear }: FilterBannerProps) {
  const isTag = !query.includes(" ");

  return (
    <div className="flex items-center gap-3 pt-6 pb-4 px-1 sticky top-0 z-10 bg-[var(--color-notebook-bg)]/95 backdrop-blur-sm border-b border-gray-100 dark:border-gray-800">
      <div className="flex items-center gap-2">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-gray-400">
          <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
        </svg>
        {isTag ? (
          <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${getTagColor(query)}`}>
            {query}
          </span>
        ) : (
          <span className="text-gray-800 dark:text-gray-200 font-medium text-sm">"{query}"</span>
        )}
      </div>
      <span className="text-xs text-gray-400">
        {count} {count === 1 ? "entry" : "entries"}
      </span>
      {onClear && (
        <button
          onClick={onClear}
          className="ml-auto text-xs text-gray-400 hover:text-gray-600 transition-colors flex items-center gap-1"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
          Clear filter
        </button>
      )}
    </div>
  );
}
