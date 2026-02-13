import type { WorkLedgerEntry } from "../../types/entry.ts";
import { EntryCard } from "./EntryCard.tsx";
import { DayHeader } from "../layout/DayHeader.tsx";
import { getTagColor } from "../../utils/tag-colors.ts";

interface EntryStreamProps {
  entriesByDay: Map<string, WorkLedgerEntry[]>;
  onSave: (entry: WorkLedgerEntry) => Promise<void>;
  onTagsChange?: (entryId: string, dayKey: string, tags: string[]) => void;
  onArchive?: (id: string) => void;
  onDelete?: (id: string) => void;
  onUnarchive?: (id: string) => void;
  isArchiveView?: boolean;
  filterQuery?: string;
  onClearFilter?: () => void;
  onOpenAI?: (entry: WorkLedgerEntry) => void;
}

export function EntryStream({ entriesByDay, onSave, onTagsChange, onArchive, onDelete, onUnarchive, isArchiveView, filterQuery, onClearFilter, onOpenAI }: EntryStreamProps) {
  const sortedDays = [...entriesByDay.keys()].sort((a, b) =>
    b.localeCompare(a),
  );

  const isFiltering = !!filterQuery?.trim();
  const totalFilteredEntries = isFiltering
    ? sortedDays.reduce((sum, dk) => sum + (entriesByDay.get(dk)?.length || 0), 0)
    : 0;

  if (sortedDays.length === 0 && isArchiveView) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center py-20">
        <div className="text-5xl mb-6 text-gray-200">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="mx-auto text-gray-300">
            <polyline points="21 8 21 21 3 21 3 8" />
            <rect x="1" y="3" width="22" height="5" />
            <line x1="10" y1="12" x2="14" y2="12" />
          </svg>
        </div>
        <h2 className="text-xl text-gray-400 font-light mb-2">
          Archive is empty
        </h2>
        <p className="text-sm text-gray-400 max-w-sm">
          Archived entries will appear here. Archive entries from the main view using the box icon.
        </p>
      </div>
    );
  }

  if (sortedDays.length === 0 && !isFiltering) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center py-20">
        <div className="text-6xl mb-6 text-gray-300">📓</div>
        <h2 className="text-2xl text-gray-500 font-light mb-3">
          Start your first entry
        </h2>
        <p className="text-base text-gray-400 max-w-sm">
          Press <kbd className="px-1.5 py-0.5 bg-gray-100 rounded text-sm font-mono">⌘J</kbd> or
          click the button below to create your first notebook entry.
        </p>
      </div>
    );
  }

  if (sortedDays.length === 0 && isFiltering) {
    return (
      <div className="entry-stream">
        <FilterBanner query={filterQuery!} count={0} onClear={onClearFilter} />
        <div className="flex flex-col items-center text-center py-16">
          <p className="text-gray-400 text-sm">No entries match "{filterQuery}"</p>
        </div>
      </div>
    );
  }

  return (
    <div className="entry-stream">
      {isFiltering && (
        <FilterBanner query={filterQuery!} count={totalFilteredEntries} onClear={onClearFilter} />
      )}
      {sortedDays.map((dayKey) => {
        const entries = entriesByDay.get(dayKey) || [];
        return (
          <div key={dayKey} id={`day-${dayKey}`}>
            {!isFiltering && (
              <DayHeader dayKey={dayKey} entryCount={entries.length} />
            )}
            {entries.map((entry, idx) => (
              <EntryCard
                key={entry.id}
                entry={entry}
                isLatest={idx === 0 && !isFiltering && !isArchiveView}
                onSave={onSave}
                onTagsChange={isArchiveView ? undefined : onTagsChange}
                onArchive={isArchiveView ? undefined : onArchive}
                onDelete={onDelete}
                onUnarchive={isArchiveView ? onUnarchive : undefined}
                isArchiveView={isArchiveView}
                onOpenAI={isArchiveView ? undefined : onOpenAI}
              />
            ))}
          </div>
        );
      })}
    </div>
  );
}

function FilterBanner({ query, count, onClear }: { query: string; count: number; onClear?: () => void }) {
  // Check if the query looks like a single tag (no spaces, could match a tag name)
  const isTag = !query.includes(" ");

  return (
    <div className="flex items-center gap-3 pt-6 pb-4 px-1 sticky top-0 z-10 bg-[#fafafa]/95 backdrop-blur-sm border-b border-gray-100">
      <div className="flex items-center gap-2">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-gray-400">
          <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
        </svg>
        {isTag ? (
          <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${getTagColor(query)}`}>
            {query}
          </span>
        ) : (
          <span className="text-gray-800 font-medium text-sm">"{query}"</span>
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
