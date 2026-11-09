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
    <div className="mt-4 pt-3 border-t border-[var(--color-notebook-ruling)]">
      <button
        onClick={() => setExpanded((p) => !p)}
        aria-expanded={expanded}
        className="flex items-center gap-2 text-[11px] text-[var(--color-notebook-muted)] hover:text-[var(--color-notebook-text)] transition-colors w-full"
      >
        <ChevronRightIcon size={10} strokeWidth={2.5} className={`transition-transform duration-200 ${expanded ? "rotate-90" : ""}`} />
        <LinkIcon size={12} />
        <span className="uppercase tracking-[0.12em] font-bold">Referenced by</span>
        <span className="font-bold">{backlinks.length}</span>
      </button>
      {expanded && (
        <div className="flex flex-wrap gap-1.5 mt-2">
          {backlinks.map((bl) => (
            <button
              key={bl.id}
              onClick={() => emit("navigate-entry", { entryId: bl.id })}
              className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-sm font-semibold text-[var(--color-notebook-text)] bg-[var(--color-notebook-highlight)] hover:brightness-95"
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
