import { useEffect, useState } from "react";
import { format, parseISO } from "date-fns";
import { getRecentSearchEntries, searchEntries, type SearchIndexEntry } from "../../entries/index.ts";
import { CheckIcon } from "../../../components/ui/Icons.tsx";

export interface AttachedNote {
  id: string;
  title: string;
}

const RECENT_LIMIT = 15;
const RESULT_LIMIT = 30;
const SEARCH_DEBOUNCE_MS = 150;

function rowTitle(row: SearchIndexEntry): string {
  return row.title || row.plainText.slice(0, 60).trim() || "Untitled";
}

interface NotePickerProps {
  selectedIds: string[];
  onToggle: (note: AttachedNote) => void;
  onClose: () => void;
}

/** Popover above the composer: recent notes, or search results while typing. Click toggles a note. The composer closes it on outside clicks. */
export function NotePicker({ selectedIds, onToggle, onClose }: NotePickerProps) {
  const [query, setQuery] = useState("");
  const [rows, setRows] = useState<SearchIndexEntry[] | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let live = true;
    const timer = setTimeout(() => {
      const load = query.trim() ? searchEntries(query).then((r) => r.slice(0, RESULT_LIMIT)) : getRecentSearchEntries(RECENT_LIMIT);
      load
        .then((r) => { if (live) { setRows(r); setFailed(false); } })
        .catch(() => { if (live) setFailed(true); });
    }, query.trim() ? SEARCH_DEBOUNCE_MS : 0);
    return () => { live = false; clearTimeout(timer); };
  }, [query]);

  return (
    <div
      role="dialog"
      aria-label="Attach notes"
      className="absolute left-3 right-3 bottom-full mb-2 rounded-xl border border-[var(--color-notebook-border)] bg-[var(--color-notebook-surface)] shadow-xl z-20 overflow-hidden"
      onKeyDown={(e) => {
        if (e.key === "Escape") {
          e.stopPropagation();
          onClose();
        }
      }}
    >
      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search notes…"
        aria-label="Search notes"
        className="ai-composer-input w-full px-3 py-2.5 text-sm bg-transparent border-b border-[var(--color-notebook-border)] outline-none text-[var(--color-notebook-text)] placeholder:text-[var(--color-notebook-muted)]"
        autoFocus
      />
      <div className="max-h-72 overflow-y-auto py-1">
        {!query.trim() && rows && rows.length > 0 && (
          <p className="px-3 pt-1.5 pb-1 text-[10px] uppercase tracking-wider text-[var(--color-notebook-muted)]">Recent</p>
        )}
        {failed && <p role="alert" className="px-3 py-2 text-xs text-[var(--color-notebook-text)]">Could not load notes.</p>}
        {rows?.length === 0 && <p className="px-3 py-2 text-xs text-[var(--color-notebook-muted)]">{query.trim() ? "No matching notes." : "No notes yet."}</p>}
        {rows?.map((row) => {
          const selected = selectedIds.includes(row.entryId);
          return (
            <button
              key={row.entryId}
              onClick={() => onToggle({ id: row.entryId, title: rowTitle(row) })}
              aria-pressed={selected}
              className="w-full flex items-center gap-2 px-3 py-1.5 text-left hover:bg-[var(--color-notebook-surface-alt)]"
            >
              <span className={`shrink-0 grid place-items-center w-4 h-4 rounded border ${selected ? "bg-[var(--color-notebook-accent)] border-[var(--color-notebook-accent)] text-[var(--color-notebook-on-accent)]" : "border-[var(--color-notebook-border)]"}`}>
                {selected && <CheckIcon size={10} strokeWidth={3} />}
              </span>
              <span className="flex-1 min-w-0 truncate text-sm text-[var(--color-notebook-text)]">{rowTitle(row)}</span>
              <span className="shrink-0 text-[11px] text-[var(--color-notebook-muted)]">{format(parseISO(row.dayKey), "MMM d")}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
