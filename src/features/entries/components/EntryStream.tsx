import { useMemo } from "react";
import type { WorkLedgerEntry } from "../types/entry.ts";
import type { SavedFilter } from "../../sidebar/index.ts";
import { EntryCard } from "./EntryCard.tsx";
import { DayHeader } from "../../../components/layout/DayHeader.tsx";
import { FilterBanner } from "./FilterBanner.tsx";
import { EmptyArchive, EmptyEntries, EmptyFilterResults } from "./EmptyStates.tsx";
import { formatDayKey, formatTime } from "../../../utils/dates.ts";
import { useProgressiveRender } from "../hooks/useProgressiveRender.ts";

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
  onSaveFilter?: (name: string) => void;
  savedFilters?: SavedFilter[];
  onPin?: (id: string) => void;
  onUnpin?: (id: string) => void;
  onSignifierChange?: (id: string, signifier: string | undefined) => void;
  onOpenAI?: (entry: WorkLedgerEntry) => void;
  focusedEntryId?: string | null;
  onFocusEntry?: (entry: WorkLedgerEntry) => void;
  onExitFocus?: () => void;
}

const noop = () => {};

export function EntryStream({ entriesByDay, onSave, onTagsChange, onArchive, onDelete, onUnarchive, isArchiveView, textQuery, selectedTags, hasActiveFilters, onRemoveTag, onClearAllFilters, onSaveFilter, savedFilters, onPin, onUnpin, onSignifierChange, onOpenAI, focusedEntryId, onFocusEntry, onExitFocus }: EntryStreamProps) {
  const isFiltering = !!hasActiveFilters;

  const sortedDays = useMemo(
    () => [...entriesByDay.keys()].sort((a, b) => b.localeCompare(a)),
    [entriesByDay],
  );

  const { pinnedEntries, pinnedIds } = useMemo(() => {
    if (isArchiveView || isFiltering) return { pinnedEntries: [] as WorkLedgerEntry[], pinnedIds: new Set<string>() };
    const pinned: WorkLedgerEntry[] = [];
    const ids = new Set<string>();
    for (const entries of entriesByDay.values()) {
      for (const entry of entries) {
        if (entry.isPinned) {
          pinned.push(entry);
          ids.add(entry.id);
        }
      }
    }
    pinned.sort((a, b) => b.updatedAt - a.updatedAt);
    return { pinnedEntries: pinned, pinnedIds: ids };
  }, [entriesByDay, isArchiveView, isFiltering]);

  const totalFilteredEntries = useMemo(
    () => isFiltering ? sortedDays.reduce((sum, dk) => sum + (entriesByDay.get(dk)?.length || 0), 0) : 0,
    [isFiltering, sortedDays, entriesByDay],
  );

  // Count total non-pinned entries across all days for progressive rendering
  const totalUnpinnedEntries = useMemo(
    () => sortedDays.reduce((sum, dk) => {
      const all = entriesByDay.get(dk) || [];
      return sum + (pinnedIds.size > 0 ? all.filter((e) => !pinnedIds.has(e.id)).length : all.length);
    }, 0),
    [sortedDays, entriesByDay, pinnedIds],
  );
  const renderedCount = useProgressiveRender(totalUnpinnedEntries);

  // Precompute per-day render limits for progressive rendering
  const dayRenderLimits = useMemo(() => {
    const limits = new Map<string, number>();
    let budget = renderedCount;
    for (const dk of sortedDays) {
      const all = entriesByDay.get(dk) || [];
      const count = pinnedIds.size > 0 ? all.filter((e) => !pinnedIds.has(e.id)).length : all.length;
      const limit = Math.min(count, budget);
      limits.set(dk, limit);
      budget -= limit;
    }
    return limits;
  }, [renderedCount, sortedDays, entriesByDay, pinnedIds]);

  // Focus mode: find the focused entry for the overlay
  const focusedEntry = useMemo(() => {
    if (!focusedEntryId) return undefined;
    for (const entries of entriesByDay.values()) {
      const found = entries.find((e) => e.id === focusedEntryId);
      if (found) return found;
    }
    return undefined;
  }, [focusedEntryId, entriesByDay]);

  const isFocused = !!focusedEntryId;

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
      {/* Focus mode overlay — rendered on top, hides the main list via CSS */}
      {isFocused && (
        focusedEntry ? (
          <div>
            <div className="flex items-center gap-3 pt-6 pb-4 px-1 sticky top-0 sticky-header">
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
                onPin={isArchiveView ? undefined : onPin}
                onUnpin={isArchiveView ? undefined : onUnpin}
                onSignifierChange={isArchiveView ? undefined : onSignifierChange}
                isArchiveView={isArchiveView}
                onOpenAI={isArchiveView ? undefined : onOpenAI}
              />
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center text-center py-16">
            <p className="text-gray-400 text-sm">Entry not found</p>
            <button onClick={onExitFocus} className="mt-4 text-sm text-blue-500 hover:text-blue-600">
              Back to all entries
            </button>
          </div>
        )
      )}

      {/* Main entry list — hidden via CSS when focused to preserve fiber tree */}
      <div style={{ display: isFocused ? "none" : undefined }}>
      {isFiltering && (
        <FilterBanner
          selectedTags={selectedTags ?? []}
          textQuery={textQuery ?? ""}
          count={totalFilteredEntries}
          onRemoveTag={onRemoveTag ?? noop}
          onClearAll={onClearAllFilters ?? noop}
          onSaveFilter={onSaveFilter}
          savedFilters={savedFilters}
        />
      )}

      {/* Pinned entries section */}
      {pinnedEntries.length > 0 && (
        <div className="mb-2">
          <div className="flex items-center gap-2 pt-6 pb-3 px-1 sticky top-0 sticky-header">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-orange-400">
              <path d="M12 17v5" />
              <path d="M9 10.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24V16h14v-.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V5a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1z" />
            </svg>
            <span className="text-[11px] uppercase tracking-wider text-orange-400 font-medium">Pinned</span>
            <span className="text-[10px] text-gray-300">{pinnedEntries.length}</span>
          </div>
          {pinnedEntries.map((entry) => (
            <div key={entry.id}>
              <EntryCard
                entry={entry}
                isLatest={false}
                onSave={onSave}
                onTagsChange={onTagsChange}
                onArchive={onArchive}
                onDelete={onDelete}
                onPin={onPin}
                onUnpin={onUnpin}
                onSignifierChange={onSignifierChange}
                onOpenAI={onOpenAI}
                onFocus={onFocusEntry}
              />
            </div>
          ))}
        </div>
      )}

      {sortedDays.map((dayKey) => {
        const allEntries = entriesByDay.get(dayKey) || [];
        const entries = pinnedIds.size > 0 ? allEntries.filter((e) => !pinnedIds.has(e.id)) : allEntries;
        const dayLimit = dayRenderLimits.get(dayKey) ?? entries.length;
        const entriesToRender = dayLimit >= entries.length ? entries : entries.slice(0, dayLimit);
        if (entries.length === 0) return null;
        return (
          <div key={dayKey} id={`day-${dayKey}`}>
            {!isFiltering && (
              <DayHeader dayKey={dayKey} entryCount={entries.length} />
            )}
            {entriesToRender.map((entry, idx) => (
              <div key={entry.id} className={idx === 0 && !isFiltering ? "mt-4" : ""}>
                <EntryCard
                  entry={entry}
                  isLatest={idx === 0 && !isFiltering && !isArchiveView}
                  onSave={onSave}
                  onTagsChange={isArchiveView ? undefined : onTagsChange}
                  onArchive={isArchiveView ? undefined : onArchive}
                  onDelete={onDelete}
                  onUnarchive={isArchiveView ? onUnarchive : undefined}
                  onPin={isArchiveView ? undefined : onPin}
                  onUnpin={isArchiveView ? undefined : onUnpin}
                  onSignifierChange={isArchiveView ? undefined : onSignifierChange}
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
    </div>
  );
}
