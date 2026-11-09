import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
import { EntryFoldedCard } from "./EntryFoldedCard.tsx";
import { EntryIndex } from "./EntryIndex.tsx";
import { useActiveEntry } from "../hooks/useActiveEntry.ts";
import { extractTitle } from "../utils/extract-title.ts";
import { useTodayKey } from "../../../hooks/useTodayKey.ts";
import { on } from "../../../utils/events.ts";
import { scrollIntoViewSettled, waitForElement } from "../../../utils/scroll.ts";

interface EntryStreamProps {
  entriesByDay: Map<string, WorkLedgerEntry[]>;
  actions: EntryActions;
  Editor: EntryEditorComponent;
  isArchiveView?: boolean;
  /** Filters are active: day headers hide and an empty result says so. */
  isFiltering?: boolean;
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

export function EntryStream({ entriesByDay, actions, Editor, isArchiveView, isFiltering = false, focusedEntryId, onExitFocus, preview, autoFocusEntryId }: EntryStreamProps) {

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

  // Today's entries start open, older ones folded; a click or navigation overrides that per entry.
  const today = useTodayKey();
  const [openOverrides, setOpenOverrides] = useState<ReadonlyMap<string, boolean>>(() => new Map());
  const setOpen = useCallback((ids: string[], open: boolean) => {
    setOpenOverrides((prev) => {
      const next = new Map(prev);
      for (const id of ids) next.set(id, open);
      return next;
    });
  }, []);
  const isOpen = (entry: WorkLedgerEntry) => openOverrides.get(entry.id) ?? entry.dayKey === today;
  const handleOpenEntry = useCallback((id: string) => setOpen([id], true), [setOpen]);
  const handleFold = useCallback((id: string) => setOpen([id], false), [setOpen]);
  useEffect(() => on("entry-revealed", ({ entryId }) => setOpen([entryId], true)), [setOpen]);
  const streamActions = useMemo(() => ({ ...actions, onFold: handleFold }), [actions, handleFold]);

  const focusedEntry = useMemo(
    () => (focusedEntryId ? findEntry(entriesByDay, focusedEntryId) : undefined),
    [focusedEntryId, entriesByDay],
  );

  // The overlay is already the focused view; it has no focus button.
  const overlayActions = useMemo(() => ({ ...actions, onFocus: undefined }), [actions]);

  const isFocused = !!focusedEntryId;
  const handleOpen = actions.onFocus ?? noop;

  // The entry under the sticky headers drives the index highlight and the day head's title.
  const mainRef = useRef<HTMLDivElement>(null);
  const layoutKey = `${renderedCount}:${openOverrides.size}:${[...openOverrides.values()].filter(Boolean).length}:${today}`;
  const activeId = useActiveEntry(mainRef, layoutKey, !preview && !isFocused);
  const active = useMemo(() => (activeId ? findEntry(entriesByDay, activeId) : undefined), [activeId, entriesByDay]);

  const indexDays = useMemo(() => [...unpinnedByDay], [unpinnedByDay]);

  const handleJump = useCallback(async (id: string) => {
    setOpen([id], true);
    if (!(await waitForElement(`entry-${id}`))) return;
    // A frame for the folded preview to be replaced by the open entry.
    requestAnimationFrame(() => scrollIntoViewSettled(() => document.getElementById(`entry-${id}`)));
  }, [setOpen]);

  if (sortedDays.length === 0 && !isFiltering) {
    return isArchiveView ? <EmptyArchive /> : <EmptyEntries />;
  }

  return (
    <div className="entry-stream">
      {/* Focus mode overlay; the main list stays mounted but hidden to keep scroll state */}
      {isFocused && (
        focusedEntry ? (
          <div className="day-sheet day-sheet-focus">
            <div className="day-head">
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
            <div>
              <EntryCard
                entry={focusedEntry}
                isLatest={focusedEntry.id === autoFocusEntryId}
                actions={overlayActions}
                Editor={Editor}
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

      {/* The list stays mounted but hidden in focus mode, to keep scroll state. */}
      <div className="stream-layout" style={{ display: isFocused ? "none" : undefined }}>
        <div className="stream-main" ref={mainRef}>
        {isFiltering && sortedDays.length === 0 && (
          <div className="flex flex-col items-center text-center py-16">
            <p className="text-gray-400 text-sm">No entries match these filters</p>
          </div>
        )}

        {pinnedEntries.length > 0 && (
          <section className="day-sheet">
            <div className="day-head">
              <PinIcon filled className="self-center text-[var(--color-notebook-text)]" />
              <h2 className="text-[var(--color-notebook-text)] day-header-font">Pinned</h2>
              <span className="day-head-count">{pinnedEntries.length}</span>
            </div>
            {pinnedEntries.filter((e) => e.id !== focusedEntryId).map((entry) => (
              <div key={entry.id} className="entry-slot">
                {preview ? (
                  <EntryPreviewRow entry={entry} onOpen={handleOpen} />
                ) : (
                  <EntryCard entry={entry} isLatest={false} actions={actions} Editor={Editor} />
                )}
              </div>
            ))}
          </section>
        )}

        {[...unpinnedByDay].map(([dayKey, entries]) => {
          const dayLimit = dayRenderLimits.get(dayKey) ?? entries.length;
          const entriesToRender = dayLimit >= entries.length ? entries : entries.slice(0, dayLimit);
          const allOpen = entries.every(isOpen);
          return (
            <section key={dayKey} id={`day-${dayKey}`} className="day-sheet">
              {!isFiltering && (
                <DayHeader
                  dayKey={dayKey}
                  entryCount={entries.length}
                  current={active?.dayKey === dayKey ? extractTitle(active) : undefined}
                  action={preview ? undefined : (
                    <button className="day-head-toggle" onClick={() => setOpen(entries.map((e) => e.id), !allOpen)}>
                      {allOpen ? "Fold all" : "Open all"}
                    </button>
                  )}
                />
              )}
              {entriesToRender.map((entry, idx) => (
                <div key={entry.id} className="entry-slot">
                  {preview ? (
                    <EntryPreviewRow entry={entry} onOpen={handleOpen} />
                  ) : isOpen(entry) ? (
                    <EntryCard
                      entry={entry}
                      isLatest={idx === 0 && !isFiltering && !isArchiveView}
                      actions={streamActions}
                      Editor={Editor}
                      isArchiveView={isArchiveView}
                    />
                  ) : (
                    <EntryFoldedCard entry={entry} onOpen={handleOpenEntry} />
                  )}
                </div>
              ))}
            </section>
          );
        })}
        </div>
        {!preview && <EntryIndex days={indexDays} activeId={activeId} onJump={handleJump} />}
      </div>
    </div>
  );
}
