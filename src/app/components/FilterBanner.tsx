import { getTagColor } from "../../utils/tag-colors.ts";
import { CloseIcon, FilterIcon } from "../../components/ui/Icons.tsx";
import { SaveFilterButton, type SavedFilter } from "../../features/sidebar/index.ts";

interface FilterBannerProps {
  selectedTags: string[];
  textQuery: string;
  count: number;
  onRemoveTag: (tag: string) => void;
  onClearAll: () => void;
  onSaveFilter?: (name: string) => void;
  savedFilters?: SavedFilter[];
}

export function FilterBanner({ selectedTags, textQuery, count, onRemoveTag, onClearAll, onSaveFilter, savedFilters }: FilterBannerProps) {
  return (
    <div className="flex items-center gap-3 pt-6 pb-4 px-1 sticky top-0 sticky-header">
      <div className="flex items-center gap-2 flex-wrap">
        <FilterIcon size={16} className="text-gray-400 shrink-0" />
        {selectedTags.map((tag) => (
          <span key={tag} className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium ${getTagColor(tag)}`}>
            {tag}
            <button
              onClick={() => onRemoveTag(tag)}
              className="hover:opacity-70 transition-opacity"
              aria-label={`Remove tag ${tag}`}
            >
              <CloseIcon size={10} strokeWidth={3} />
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
      <div className="ml-auto flex items-center gap-3 shrink-0">
        {onSaveFilter && (
          <SaveFilterButton
            onSave={onSaveFilter}
            savedFilters={savedFilters}
            selectedTags={selectedTags}
            textQuery={textQuery}
          />
        )}
        <button
          onClick={onClearAll}
          className="text-xs text-gray-400 hover:text-gray-600 transition-colors flex items-center gap-1 shrink-0"
        >
          <CloseIcon />
          Clear all
        </button>
      </div>
    </div>
  );
}
