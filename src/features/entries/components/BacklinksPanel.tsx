import { useState, useEffect, useRef, memo } from "react";
import { getBacklinks } from "../storage/backlinks.ts";
import { getEntries } from "../storage/entries.ts";
import { extractTitle } from "../utils/extract-title.ts";
import { formatDayKey } from "../../../utils/dates.ts";
import { emit, on } from "../../../utils/events.ts";
import { ChevronRightIcon, FileIcon, LinkIcon } from "../../../components/ui/Icons.tsx";

interface BacklinkEntry {
  id: string;
  title: string;
  dayKey: string;
}

interface BacklinksPanelProps {
  entryId: string;
}

function sameIds(a: string[], b: string[]): boolean {
  return a.length === b.length && a.every((id, i) => id === b[i]);
}

export const BacklinksPanel = memo(function BacklinksPanel({ entryId }: BacklinksPanelProps) {
  const [backlinks, setBacklinks] = useState<BacklinkEntry[]>([]);
  const [expanded, setExpanded] = useState(true);
  const sourceIdsRef = useRef<string[]>([]);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      const sourceIds = await getBacklinks(entryId);
      const sources = sourceIds.length > 0 ? await getEntries(sourceIds) : [];
      if (cancelled) return;
      sourceIdsRef.current = sourceIds;
      setBacklinks(
        sources
          .filter((e) => !e.isArchived)
          .map((e) => ({ id: e.id, title: extractTitle(e), dayKey: e.dayKey })),
      );
    };

    // getBacklinks is served from memory, so checking on every change is cheap.
    // Reload only when the source list changed or a source itself changed (title).
    const handleChange = async ({ entryId: changedId }: { entryId: string }) => {
      if (changedId === entryId) return; // self-edits can't create backlinks to self
      const sourceIds = await getBacklinks(entryId);
      if (cancelled) return;
      if (sourceIds.includes(changedId) || !sameIds(sourceIds, sourceIdsRef.current)) load();
    };

    load();
    const unsubChange = on("entry-changed", handleChange);
    const unsubDelete = on("entry-deleted", handleChange);
    return () => {
      cancelled = true;
      unsubChange();
      unsubDelete();
    };
  }, [entryId]);

  if (backlinks.length === 0) return null;

  return (
    <div className="mx-1 mt-1 mb-1 rounded-lg bg-[var(--color-notebook-surface-alt)] border border-[var(--color-notebook-border)] px-3 py-2">
      <button
        onClick={() => setExpanded((p) => !p)}
        className="flex items-center gap-2 text-[11px] text-[var(--color-notebook-muted)] hover:text-[var(--color-notebook-text)] transition-colors w-full"
      >
        <ChevronRightIcon size={10} strokeWidth={2.5} className={`transition-transform duration-200 ${expanded ? "rotate-90" : ""}`} />
        <LinkIcon size={12} />
        <span className="uppercase tracking-wider font-medium">Referenced by</span>
        <span className="text-[10px] opacity-60">{backlinks.length}</span>
      </button>
      {expanded && (
        <div className="flex flex-wrap gap-1.5 mt-2">
          {backlinks.map((bl) => (
            <button
              key={bl.id}
              onClick={() => emit("navigate-entry", { entryId: bl.id })}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 hover:bg-amber-200 dark:hover:bg-amber-900/50 transition-colors"
              title={formatDayKey(bl.dayKey)}
            >
              <FileIcon size={10} className="opacity-50" />
              {bl.title}
            </button>
          ))}
        </div>
      )}
    </div>
  );
});
