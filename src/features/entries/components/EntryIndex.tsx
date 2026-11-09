import { memo, useEffect, useRef } from "react";
import type { WorkLedgerEntry } from "../types/entry.ts";
import { extractTitle } from "../utils/extract-title.ts";
import { formatDayParts, formatTime } from "../../../utils/dates.ts";

interface EntryIndexProps {
  days: [dayKey: string, entries: WorkLedgerEntry[]][];
  activeId: string | null;
  onJump: (entryId: string) => void;
}

interface IndexRowProps {
  entry: WorkLedgerEntry;
  active: boolean;
  onJump: (entryId: string) => void;
}

// Memoized on the entry object, which keeps its identity until that entry changes,
// so a save re-renders one row, not the whole index.
const IndexRow = memo(function IndexRow({ entry, active, onJump }: IndexRowProps) {
  return (
    <button
      className="entry-index-row"
      data-active={active || undefined}
      aria-current={active || undefined}
      onClick={() => onJump(entry.id)}
    >
      <span className="entry-index-time">{formatTime(entry.createdAt)}</span>
      <span className="entry-index-title">{extractTitle(entry)}</span>
      {entry.signifier && <span className="entry-index-dot" data-signifier={entry.signifier} aria-hidden="true" />}
    </button>
  );
});

/** The loaded entries by day, beside the pages; the one being read is marked. */
export const EntryIndex = memo(function EntryIndex({ days, activeId, onJump }: EntryIndexProps) {
  const ref = useRef<HTMLElement>(null);

  // Keep the active row in view by scrolling the index itself. scrollIntoView
  // would also scroll the page.
  useEffect(() => {
    const nav = ref.current;
    const row = nav?.querySelector<HTMLElement>("[data-active]");
    if (!nav || !row) return;
    const top = row.getBoundingClientRect().top - nav.getBoundingClientRect().top + nav.scrollTop;
    if (top < nav.scrollTop || top + row.offsetHeight > nav.scrollTop + nav.clientHeight) {
      nav.scrollTop = top - nav.clientHeight / 3;
    }
  }, [activeId]);

  return (
    <nav ref={ref} className="entry-index" aria-label="Entries on this page">
      {days.map(([dayKey, entries]) => {
        const { name, detail } = formatDayParts(dayKey);
        return (
          <div key={dayKey} className="entry-index-day">
            <div className="entry-index-label">{name} <span>{name === "Today" || name === "Yesterday" ? "" : detail}</span></div>
            {entries.map((entry) => (
              <IndexRow key={entry.id} entry={entry} active={entry.id === activeId} onJump={onJump} />
            ))}
          </div>
        );
      })}
    </nav>
  );
});
