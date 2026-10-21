import { useMemo } from "react";
import type { EntryActions, EntryEditorComponent, WorkLedgerEntry } from "../types/entry.ts";
import { EntryCard } from "./EntryCard.tsx";
import { DayHeader } from "../../../components/layout/DayHeader.tsx";
import { EmptyArchive, EmptyEntries } from "./EmptyStates.tsx";
import { ArrowLeftIcon, PinIcon } from "../../../components/ui/Icons.tsx";
import { formatDayKey, formatTime } from "../../../utils/dates.ts";
import { findEntry } from "../utils/entries-state.ts";
import { useProgressiveRender } from "../hooks/useProgressiveRender.ts";
import { EntryDetailControls } from "./EntryDetailControls.tsx";
import { EntryPreviewRow } from "./EntryPreviewRow.tsx";

interface EntryStreamProps {
  entriesByDay: Map<string, WorkLedgerEntry[]>;
  actions: EntryActions;
  Editor: EntryEditorComponent;
  isArchiveView?: boolean;
  /** Filters are active: day headers hide and an empty result says so. */
  isFiltering?: boolean;
  /** Entry the AI sidebar is working on; its "Think with AI" button shows as pressed. */
  aiEntryId?: string | null;
  focusedEntryId?: string | null;
  onExitFocus?: () => void;
  /**
   * Compact layout for small screens: entries are preview rows that open
   * full-screen (through `actions.onFocus`), with info and actions behind buttons.
   */
  preview?: boolean;
  /** Entry to put the cursor in when it opens full-screen (a just-created one). */
  autoFocusEntryId?: string | null;
}

function noop() {}

export function EntryStream({ entriesByDay, actions, Editor, isArchiveView, isFiltering = false, aiEntryId, focusedEntryId, onExitFocus, preview, autoFocusEntryId }: EntryStreamProps) {

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

  // The focused entry renders in the overlay only. A second, hidden editor for
  // the same entry would replay each save into the other and loop.
  const unpinnedByDay = useMemo(() => {
    const result = new Map<string, WorkLedgerEntry[]>();
    for (const dayKey of sortedDays) {
      const entries = (entriesByDay.get(dayKey) ?? []).filter(
        (e) => !pinnedIds.has(e.id) && e.id !== focusedEntryId,
      );
      if (entries.length > 0) result.set(dayKey, entries);
    }
    return result;
  }, [sortedDays, entriesByDay, pinnedIds, focusedEntryId]);

  const totalUnpinnedEntries = useMemo(
    () => [...unpinnedByDay.values()].reduce((sum, entries) => sum + entries.length, 0),
    [unpinnedByDay],
  );
  const renderedCount = useProgressiveRender(totalUnpinnedEntries);

  // Progressive rendering budget is spent day by day, newest first.
  const dayRenderLimits = useMemo(() => {
    const limits = new Map<string, number>();
    let budget = renderedCount;
    for (const [dayKey, entries] of unpinnedByDay) {
      const limit = Math.min(entries.length, budget);
      limits.set(dayKey, limit);
      budget -= limit;
    }
    return limits;
  }, [renderedCount, unpinnedByDay]);

  const focusedEntry = useMemo(
    () => (focusedEntryId ? findEntry(entriesByDay, focusedEntryId) : undefined),
    [focusedEntryId, entriesByDay],
  );

  // The overlay is already the focused view; it has no focus button.
  const overlayActions = useMemo(() => ({ ...actions, onFocus: undefined }), [actions]);

  const isFocused = !!focusedEntryId;
  const handleOpen = actions.onFocus ?? noop;

  if (sortedDays.length === 0 && !isFiltering) {
    return isArchiveView ? <EmptyArchive /> : <EmptyEntries />;
  }

  return (
    <div className="entry-stream">
      {/* Focus mode overlay; the main list stays mounted but hidden to keep scroll state */}
      {isFocused && (
        focusedEntry ? (
          <div>
            <div className={`flex items-center gap-3 px-1 sticky top-0 sticky-header ${preview ? "py-2" : "pt-4 pb-3"}`}>
              <button
                onClick={onExitFocus}
                className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                title="Back to all entries (Esc)"
                aria-label="Back to all entries"
              >
                <ArrowLeftIcon size={preview ? 22 : 18} />
              </button>
              <span className="flex-1 min-w-0 truncate text-sm text-gray-500 dark:text-gray-400">
                {formatDayKey(focusedEntry.dayKey)} &middot; {formatTime(focusedEntry.createdAt)}
              </span>
              {preview && (
                <EntryDetailControls entry={focusedEntry} actions={actions} isArchiveView={isArchiveView} onGone={onExitFocus ?? noop} />
              )}
            </div>
            <div className={preview ? "pt-3" : "pt-4"}>
              <EntryCard
                entry={focusedEntry}
                isLatest={focusedEntry.id === autoFocusEntryId}
                actions={overlayActions}
                Editor={Editor}
                aiActive={focusedEntry.id === aiEntryId}
                isArchiveView={isArchiveView}
                bare={preview}
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

      <div style={{ display: isFocused ? "none" : undefined }}>
        {isFiltering && sortedDays.length === 0 && (
          <div className="flex flex-col items-center text-center py-16">
            <p className="text-gray-400 text-sm">No entries match these filters</p>
          </div>
        )}

        {pinnedEntries.length > 0 && (
          <div className="mb-2">
            <div className="flex items-center gap-2 pt-6 pb-3 px-1 sticky top-0 sticky-header">
              <PinIcon filled className="text-orange-400" />
              <span className="text-[11px] uppercase tracking-wider text-orange-400 font-medium">Pinned</span>
              <span className="text-[10px] text-gray-300">{pinnedEntries.length}</span>
            </div>
            {pinnedEntries.filter((e) => e.id !== focusedEntryId).map((entry) => (
              <div key={entry.id}>
                {preview ? (
                  <EntryPreviewRow entry={entry} onOpen={handleOpen} />
                ) : (
                  <EntryCard entry={entry} isLatest={false} actions={actions} Editor={Editor} aiActive={entry.id === aiEntryId} />
                )}
              </div>
            ))}
          </div>
        )}

        {[...unpinnedByDay].map(([dayKey, entries]) => {
          const dayLimit = dayRenderLimits.get(dayKey) ?? entries.length;
          const entriesToRender = dayLimit >= entries.length ? entries : entries.slice(0, dayLimit);
          return (
            <div key={dayKey} id={`day-${dayKey}`}>
              {!isFiltering && (
                <DayHeader dayKey={dayKey} entryCount={entries.length} />
              )}
              {entriesToRender.map((entry, idx) => (
                <div key={entry.id} className={idx === 0 && !isFiltering && !preview ? "mt-3" : ""}>
                  {preview ? (
                    <EntryPreviewRow entry={entry} onOpen={handleOpen} />
                  ) : (
                    <EntryCard
                      entry={entry}
                      isLatest={idx === 0 && !isFiltering && !isArchiveView}
                      actions={actions}
                      Editor={Editor}
                      isArchiveView={isArchiveView}
                      aiActive={entry.id === aiEntryId}
                    />
                  )}
                </div>
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}
