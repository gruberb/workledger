import { getTagColor } from "../../utils/tag-colors.ts";
import { CloseIcon, FilterIcon } from "../../components/ui/Icons.tsx";
import { SaveFilterButton, type SavedFilter } from "../../features/sidebar/index.ts";
import { SIGNIFIER_CONFIG, type EntrySignifier } from "../../features/entries/index.ts";

interface FilterBannerProps {
  selectedTags: string[];
  selectedSignifiers: EntrySignifier[];
  count: number;
  onRemoveTag: (tag: string) => void;
  onRemoveSignifier: (signifier: EntrySignifier) => void;
  onClearAll: () => void;
  onSaveFilter?: (name: string) => void;
  savedFilters?: SavedFilter[];
}

interface ChipProps {
  label: string;
  className: string;
  onRemove: () => void;
}

function Chip({ label, className, onRemove }: ChipProps) {
  return (
    <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium whitespace-nowrap ${className}`}>
      {label}
      <button onClick={onRemove} className="hover:opacity-70 transition-opacity" aria-label={`Remove filter ${label}`}>
        <CloseIcon size={10} strokeWidth={3} />
      </button>
    </span>
  );
}

/** Active filters as the header bar: chips on the left, Save and Clear all on the right. */
export function FilterBanner({ selectedTags, selectedSignifiers, count, onRemoveTag, onRemoveSignifier, onClearAll, onSaveFilter, savedFilters }: FilterBannerProps) {
  return (
    <div className="flex items-center gap-2 min-w-0 w-full" role="group" aria-label="Active filters">
      <FilterIcon size={16} className="text-[var(--color-notebook-muted)] shrink-0" />
      {/* Chips scroll sideways instead of wrapping, so the header keeps its height. */}
      <div className="flex items-center gap-1.5 min-w-0 overflow-x-auto [scrollbar-width:none]">
        {selectedSignifiers.map((s) => (
          <Chip key={s} label={SIGNIFIER_CONFIG[s].label} className={`${SIGNIFIER_CONFIG[s].chip} ${SIGNIFIER_CONFIG[s].color}`} onRemove={() => onRemoveSignifier(s)} />
        ))}
        {selectedTags.map((tag) => (
          <Chip key={tag} label={tag} className={getTagColor(tag)} onRemove={() => onRemoveTag(tag)} />
        ))}
      </div>
      <span className="text-xs text-[var(--color-notebook-muted)] whitespace-nowrap shrink-0">
        {count} {count === 1 ? "entry" : "entries"}
      </span>
      <div className="ml-auto flex items-center gap-1 shrink-0">
        {onSaveFilter && (
          <SaveFilterButton
            compact
            onSave={onSaveFilter}
            savedFilters={savedFilters}
            selectedTags={selectedTags}
            selectedSignifiers={selectedSignifiers}
          />
        )}
        <button
          onClick={onClearAll}
          className="h-8 px-2 rounded-md text-xs text-[var(--color-notebook-muted)] hover:text-[var(--color-notebook-text)] hover:bg-[var(--color-notebook-surface-alt)] transition-colors flex items-center gap-1 whitespace-nowrap"
          title="Clear all filters (Esc)"
        >
          <CloseIcon />
          Clear all
        </button>
      </div>
    </div>
  );
}
