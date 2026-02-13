import type { WorkLedgerEntry } from "../types/entry.ts";
import { EntryCard } from "./EntryCard.tsx";
import { DayHeader } from "../../../components/layout/DayHeader.tsx";
import { FilterBanner } from "./FilterBanner.tsx";
import { EmptyArchive, EmptyEntries, EmptyFilterResults } from "./EmptyStates.tsx";
import { formatDayKey, formatTime } from "../utils/dates.ts";

interface EntryStreamProps {
  entriesByDay: Map<string, WorkLedgerEntry[]>;
  onSave: (entry: WorkLedgerEntry) => Promise<void>;
  onTagsChange?: (entryId: string, dayKey: string, tags: string[]) => void;
  onArchive?: (id: string) => void;
  onDelete?: (id: string) => void;
  onUnarchive?: (id: string) => void;
  isArchiveView?: boolean;
  textQuery?: string;
  selectedTags?: string[];
  hasActiveFilters?: boolean;
  onRemoveTag?: (tag: string) => void;
  onClearAllFilters?: () => void;
  onOpenAI?: (entry: WorkLedgerEntry) => void;
  focusedEntryId?: string | null;
  onFocusEntry?: (entry: WorkLedgerEntry) => void;
  onExitFocus?: () => void;
}

export function EntryStream({ entriesByDay, onSave, onTagsChange, onArchive, onDelete, onUnarchive, isArchiveView, textQuery, selectedTags, hasActiveFilters, onRemoveTag, onClearAllFilters, onOpenAI, focusedEntryId, onFocusEntry, onExitFocus }: EntryStreamProps) {
  // Focus mode: render only the focused entry
  if (focusedEntryId) {
    let focusedEntry: WorkLedgerEntry | undefined;
    for (const entries of entriesByDay.values()) {
      focusedEntry = entries.find((e) => e.id === focusedEntryId);
      if (focusedEntry) break;
    }

    if (!focusedEntry) {
      return (
        <div className="entry-stream">
          <div className="flex flex-col items-center text-center py-16">
            <p className="text-gray-400 text-sm">Entry not found</p>
            <button onClick={onExitFocus} className="mt-4 text-sm text-blue-500 hover:text-blue-600">
              Back to all entries
            </button>
          </div>
        </div>
      );
    }

    return (
      <div className="entry-stream">
        <div className="flex items-center gap-3 pt-6 pb-4 px-1 sticky top-0 z-10 bg-[var(--color-notebook-bg)]/95 backdrop-blur-sm border-b border-gray-100 dark:border-gray-800">
          <button
            onClick={onExitFocus}
            className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
            title="Back to all entries (Esc)"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="19" y1="12" x2="5" y2="12" />
              <polyline points="12 19 5 12 12 5" />
            </svg>
          </button>
          <span className="text-sm text-gray-500 dark:text-gray-400">
            {formatDayKey(focusedEntry.dayKey)} &middot; {formatTime(focusedEntry.createdAt)}
          </span>
        </div>
        <div className="pt-6">
          <EntryCard
            entry={focusedEntry}
            isLatest={false}
            onSave={onSave}
            onTagsChange={isArchiveView ? undefined : onTagsChange}
            onArchive={isArchiveView ? undefined : onArchive}
            onDelete={onDelete}
            onUnarchive={isArchiveView ? onUnarchive : undefined}
            isArchiveView={isArchiveView}
            onOpenAI={isArchiveView ? undefined : onOpenAI}
          />
        </div>
      </div>
    );
  }

  const sortedDays = [...entriesByDay.keys()].sort((a, b) =>
    b.localeCompare(a),
  );

  const isFiltering = !!hasActiveFilters;
  const totalFilteredEntries = isFiltering
    ? sortedDays.reduce((sum, dk) => sum + (entriesByDay.get(dk)?.length || 0), 0)
    : 0;

  if (sortedDays.length === 0 && isArchiveView) {
    return <EmptyArchive />;
  }

  if (sortedDays.length === 0 && !isFiltering) {
    return <EmptyEntries />;
  }

  if (sortedDays.length === 0 && isFiltering) {
    return <EmptyFilterResults selectedTags={selectedTags ?? []} textQuery={textQuery ?? ""} onClearAllFilters={onClearAllFilters} />;
  }

  return (
    <div className="entry-stream">
      {isFiltering && (
        <FilterBanner
          selectedTags={selectedTags ?? []}
          textQuery={textQuery ?? ""}
          count={totalFilteredEntries}
          onRemoveTag={onRemoveTag ?? (() => {})}
          onClearAll={onClearAllFilters ?? (() => {})}
        />
      )}
      {sortedDays.map((dayKey) => {
        const entries = entriesByDay.get(dayKey) || [];
        return (
          <div key={dayKey} id={`day-${dayKey}`}>
            {!isFiltering && (
              <DayHeader dayKey={dayKey} entryCount={entries.length} />
            )}
            {entries.map((entry, idx) => (
              <div key={entry.id} className={idx === 0 && !isFiltering ? "mt-4" : ""}>
                <EntryCard
                  entry={entry}
                  isLatest={idx === 0 && !isFiltering && !isArchiveView}
                  onSave={onSave}
                  onTagsChange={isArchiveView ? undefined : onTagsChange}
                  onArchive={isArchiveView ? undefined : onArchive}
                  onDelete={onDelete}
                  onUnarchive={isArchiveView ? onUnarchive : undefined}
                  isArchiveView={isArchiveView}
                  onOpenAI={isArchiveView ? undefined : onOpenAI}
                  onFocus={isArchiveView ? undefined : onFocusEntry}
                />
              </div>
            ))}
          </div>
        );
      })}
    </div>
  );
}
