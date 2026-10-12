import { memo } from "react";
import type { WorkLedgerEntry } from "../types/entry.ts";
import { SIGNIFIER_CONFIG } from "../types/entry.ts";
import { extractTitle, extractPreview } from "../utils/extract-title.ts";
import { formatTime } from "../../../utils/dates.ts";
import { PinIcon } from "../../../components/ui/Icons.tsx";
import { getTagColor } from "../../../utils/tag-colors.ts";

interface EntryPreviewRowProps {
  entry: WorkLedgerEntry;
  onOpen: (entry: WorkLedgerEntry) => void;
}

/** One entry as a title, two lines of text and metadata. Tapping opens it full-screen. */
export const EntryPreviewRow = memo(function EntryPreviewRow({ entry, onOpen }: EntryPreviewRowProps) {
  const preview = extractPreview(entry);
  const signifier = entry.signifier ? SIGNIFIER_CONFIG[entry.signifier] : undefined;

  return (
    <button
      id={`entry-${entry.id}`}
      onClick={() => onOpen(entry)}
      className="entry-preview-row w-full text-left px-1 py-3 border-b border-[var(--color-notebook-border)] active:bg-[var(--color-notebook-surface-alt)] transition-colors scroll-mt-[120px]"
    >
      <span className="flex items-center gap-1.5">
        {entry.isPinned && <PinIcon filled size={12} className="text-orange-400 shrink-0" />}
        <span className="font-semibold text-[var(--color-notebook-text)] truncate">{extractTitle(entry)}</span>
      </span>
      {preview && (
        <span className="mt-0.5 block text-sm text-[var(--color-notebook-muted)] line-clamp-2">{preview}</span>
      )}
      <span className="mt-1.5 flex items-center gap-2 text-[11px] text-gray-400 dark:text-gray-500">
        <span className="font-mono">{formatTime(entry.createdAt)}</span>
        {signifier && <span className={`font-medium ${signifier.color}`}>{signifier.label}</span>}
        {entry.tags?.slice(0, 3).map((tag) => (
          <span key={tag} className={`px-1.5 py-px rounded-full ${getTagColor(tag)}`}>{tag}</span>
        ))}
      </span>
    </button>
  );
});
