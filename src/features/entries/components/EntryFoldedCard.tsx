import { memo } from "react";
import type { WorkLedgerEntry } from "../types/entry.ts";
import { SIGNIFIER_CONFIG } from "../types/entry.ts";
import { extractPreview, extractTitle } from "../utils/extract-title.ts";
import { formatTime } from "../../../utils/dates.ts";
import { PinIcon } from "../../../components/ui/Icons.tsx";

interface EntryFoldedCardProps {
  entry: WorkLedgerEntry;
  onOpen: (entryId: string) => void;
}

/**
 * An older entry shown as title, preview and tags. Mounts no editor, so a long
 * journal stays quick to scan and cheap to render; a click opens it in place.
 */
export const EntryFoldedCard = memo(function EntryFoldedCard({ entry, onOpen }: EntryFoldedCardProps) {
  const title = extractTitle(entry);
  const preview = extractPreview(entry);
  const signifier = entry.signifier ? SIGNIFIER_CONFIG[entry.signifier] : undefined;

  return (
    <button
      id={`entry-${entry.id}`}
      data-entry-id={entry.id}
      className="entry-folded scroll-mt-[132px]"
      onClick={() => onOpen(entry.id)}
      title="Open entry"
    >
      <span className="entry-folded-meta">
        <span className="entry-time">{formatTime(entry.createdAt)}</span>
        {signifier && <span className="sticker" data-signifier={entry.signifier}>{signifier.label}</span>}
        {entry.isPinned && <PinIcon filled size={12} aria-label="Pinned" />}
      </span>
      <span className="entry-folded-title">{title}</span>
      {preview && <span className="entry-folded-preview">{preview}</span>}
      {entry.tags.length > 0 && (
        <span className="entry-folded-tags">
          {entry.tags.map((tag) => <span key={tag} className="tag-chip">#{tag}</span>)}
        </span>
      )}
    </button>
  );
});
